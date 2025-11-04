import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import sgMail from "@sendgrid/mail";
import twilio from "twilio";
import { Kafka } from "kafkajs";
import { logger } from "./Logger.js";

// --- Configuración de variables de entorno ---
dotenv.config();
const app = express();
app.use(express.json());
logger.info("[App]", "Inicializando servicio de notificaciones");

// --- Cargar plantillas ---
let emailTemplates = {};
let smsTemplates = {};

try {
    emailTemplates = JSON.parse(
        fs.readFileSync(path.join("src/templates/emailTemplates.json"))
    );
    smsTemplates = JSON.parse(
        fs.readFileSync(path.join("src/templates/smsTemplates.json"))
    );
    logger.info("[App]", "Plantillas cargadas correctamente", {
        emailTemplatesCount: Object.keys(emailTemplates).length,
        smsTemplatesCount: Object.keys(smsTemplates).length,
    });
} catch (error) {
    logger.error("[App]", "Error cargando plantillas", { error: error.message });
    process.exit(1);
}

// Helper para renderizar plantillas con {{variables}}
const renderTemplate = (template, data) =>
    template.replace(/{{(.*?)}}/g, (_, key) => data[key.trim()] || "");

// --- Configuración de SendGrid ---
try {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    logger.info("[EmailService]", "SendGrid inicializado correctamente", {
        sender: process.env.SENDGRID_FROM,
    });
} catch (error) {
    logger.error("[EmailService]", "Error inicializando SendGrid", {
        error: error.message,
    });
    process.exit(1);
}

// --- Configuración de Kafka ---
let consumer;
try {
    const kafka = new Kafka({
        clientId: "notificaciones-service",
        brokers: process.env.KAFKA_BROKERS.split(","),
    });
    consumer = kafka.consumer({ groupId: "notificaciones-group" });
    logger.info("[Kafka]", "Cliente Kafka configurado correctamente", {
        brokers: process.env.KAFKA_BROKERS,
    });
} catch (error) {
    logger.error("[Kafka]", "Error configurando Kafka", { error: error.message });
    process.exit(1);
}

// --- Configuración de Twilio ---
let client;
try {
    client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
    );
    logger.info("[SmsService]", "Cliente Twilio inicializado correctamente", {
        phone: process.env.TWILIO_PHONE,
    });
} catch (error) {
    logger.error("[SmsService]", "Error inicializando Twilio", {
        error: error.message,
    });
    process.exit(1);
}

// ------------------ ENDPOINTS ------------------

// --- Enviar correo ---
app.post("/send-email", async (req, res) => {
    const { to, template, data } = req.body;
    logger.info("[EmailService]", "Solicitud recibida para enviar correo", {
        to,
        template,
    });

    try {
        if (!emailTemplates[template]) {
            logger.warn("[EmailService]", "Plantilla de correo no encontrada", {
                template,
            });
            return res.status(400).json({ message: "Plantilla de correo no encontrada" });
        }

        const subject = renderTemplate(emailTemplates[template].subject, data);
        const text = renderTemplate(emailTemplates[template].text, data);

        await sgMail.send({
            to,
            from: process.env.SENDGRID_FROM,
            subject,
            text,
        });

        logger.info("[EmailService]", "Correo enviado exitosamente", { to, template });
        res.status(200).json({ message: "Correo enviado ✅" });
    } catch (error) {
        logger.error("[EmailService]", "Error enviando correo", {
            error: error.message,
            to,
            template,
        });
        res.status(500).json({
            message: "Error enviando correo",
            error: error.message,
        });
    }
});

// --- Enviar SMS ---
app.post("/send-sms", async (req, res) => {
    const { to, template, data } = req.body;
    logger.info("[SmsService]", "Solicitud recibida para enviar SMS", {
        to,
        template,
    });

    try {
        if (!smsTemplates[template]) {
            logger.warn("[SmsService]", "Plantilla SMS no encontrada", { template });
            return res.status(400).json({ message: "Plantilla SMS no encontrada" });
        }

        const body = renderTemplate(smsTemplates[template], data);

        const message = await client.messages.create({
            body,
            from: process.env.TWILIO_PHONE,
            to,
        });

        logger.info("[SmsService]", "SMS enviado exitosamente", {
            to,
            sid: message.sid,
        });
        res.status(200).json({
            message: "SMS enviado ✅",
            sid: message.sid,
        });
    } catch (error) {
        logger.error("[SmsService]", "Error enviando SMS", {
            error: error.message,
            to,
            template,
        });
        res.status(500).json({
            message: "Error enviando SMS",
            error: error.message,
        });
    }
});


// ------------------ KAFKA CONSUMER ------------------
const startKafkaConsumer = async () => {
    const logContext = "kafka-consumer";

    try {
        await consumer.connect();
        logger.info(logContext, "Conexión establecida con Kafka");

        await consumer.subscribe({
            topic: process.env.KAFKA_TOPIC || "notifications",
            fromBeginning: false,
        });

        logger.info(logContext, "Suscripción exitosa al topic", {
            topic: process.env.KAFKA_TOPIC || "notifications",
        });

        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                const meta = { topic, partition, offset: message.offset };

                try {
                    const payload = JSON.parse(message.value.toString());
                    logger.info(logContext, "Mensaje recibido de Kafka", { ...meta, payload });

                    if (payload.type === "EMAIL") {
                        const template = emailTemplates[payload.template];

                        if (!template) {
                            logger.error(logContext, "Template no encontrado", {
                                template: payload.template,
                                ...meta,
                            });
                            return;
                        }

                        const subject = renderTemplate(template.subject, payload.data);
                        const text = renderTemplate(template.text, payload.data);

                        await sgMail.send({
                            to: payload.to,
                            from: process.env.SENDGRID_FROM,
                            subject,
                            text,
                        });

                        logger.info(logContext, "Correo enviado exitosamente", {
                            to: payload.to,
                            template: payload.template,
                            subject,
                            ...meta,
                        });

                    } else if (payload.type === "SMS") {
                        const body = renderTemplate(smsTemplates[payload.template], payload.data);

                        await client.messages.create({
                            body,
                            from: process.env.TWILIO_PHONE,
                            to: payload.to,
                        });

                        logger.info(logContext, "SMS enviado exitosamente", {
                            to: payload.to,
                            template: payload.template,
                            ...meta,
                        });

                    } else {
                        logger.warn(logContext, "Tipo de mensaje Kafka no reconocido", {
                            type: payload.type,
                            ...meta,
                        });
                    }

                } catch (error) {
                    logger.error(logContext, "Error procesando mensaje Kafka", {
                        error: error.message,
                        stack: error.stack,
                        ...meta,
                    });
                }
            },
        });

        logger.info(logContext, "Consumidor Kafka en ejecución");

    } catch (error) {
        logger.error(logContext, "Error inicializando consumidor Kafka", {
            error: error.message,
            stack: error.stack,
        });

        // Reintento automático si el consumidor falla
        setTimeout(() => {
            logger.warn(logContext, "Reintentando conexión con Kafka en 5s");
            startKafkaConsumer();
        }, 5000);
    }
};

// --- Servidor Express ---
const PORT = process.env.PORT || 8083;
app.listen(PORT, () => {
    logger.info("notification-service", "Servicio de notificaciones iniciado", {
        port: PORT,
    });
    startKafkaConsumer();
});
