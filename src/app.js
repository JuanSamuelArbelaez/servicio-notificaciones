import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import sgMail from "@sendgrid/mail";
import twilio from "twilio";
import { Kafka } from "kafkajs";

// --- Configuración de variables de entorno ---
dotenv.config();
const app = express();
app.use(express.json());   // Permite recibir datos en formato JSON en el body

// --- Cargar plantillas ---
const emailTemplates = JSON.parse(
    fs.readFileSync(path.join("src/templates/emailTemplates.json"))
);
const smsTemplates = JSON.parse(
    fs.readFileSync(path.join("src/templates/smsTemplates.json"))
);

// Helper para renderizar plantillas con {{variables}}
const renderTemplate = (template, data) => {
    return template.replace(/{{(.*?)}}/g, (_, key) => data[key.trim()] || "");
};

// --- Configuración de SendGrid ---
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// --- Configuración de Kafka ---
const kafka = new Kafka({
    clientId: "notificaciones-service",
    brokers: process.env.KAFKA_BROKERS.split(","), // ej: "kafka:9092"
});
const consumer = kafka.consumer({ groupId: "notificaciones-group" });

// --- Configuración de Twilio ---
const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

// ------------------ ENDPOINTS ------------------

/**
 * Endpoint para enviar correos electrónicos
 * Método: POST
 * Ruta: /send-email
 * Body esperado:
 * {
 *   "to": "correo@destino.com",
 *   "template": "welcome",
 *   "data": { "name": "Anderson" }
 * }
 */
app.post("/send-email", async (req, res) => {
    const { to, template, data } = req.body;

    try {
        const subject = renderTemplate(emailTemplates[template].subject, data);
        const text = renderTemplate(emailTemplates[template].text, data);

        await sgMail.send({
            to,
            from: process.env.SENDGRID_FROM,
            subject,
            text,
        });

        res.status(200).json({ message: "Correo enviado ✅" });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Error enviando correo",
            error: error.message,
        });
    }
});

/**
 * Endpoint para enviar SMS
 * Método: POST
 * Ruta: /send-sms
 * Body esperado:
 * {
 *   "to": "+573001112233",
 *   "template": "verification",
 *   "data": { "name": "Anderson", "code": "123456" }
 * }
 */
app.post("/send-sms", async (req, res) => {
    const { to, template, data } = req.body;

    try {
        const body = renderTemplate(smsTemplates[template], data);

        const message = await client.messages.create({
            body,
            from: process.env.TWILIO_PHONE,
            to,
        });

        res.status(200).json({
            message: "SMS enviado ✅",
            sid: message.sid,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Error enviando SMS",
            error: error.message,
        });
    }
});

// ------------------ KAFKA CONSUMER ------------------

const startKafkaConsumer = async () => {
    await consumer.connect();
    await consumer.subscribe({
        topic: process.env.KAFKA_TOPIC || "notifications",
        fromBeginning: false,
    });

    console.log("✅ Consumidor Kafka escuchando topic:", process.env.KAFKA_TOPIC || "notifications");

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            try {
                const payload = JSON.parse(message.value.toString());
                console.log("📩 Mensaje recibido de Kafka:", payload);

                if (payload.type === "EMAIL") {
                    const template = emailTemplates[payload.template];

                    if (!template) {
                        console.error(`❌ Template no encontrado: ${payload.template}`);
                        return;
                    }

                    // Siempre usar el subject y text del template
                    const subject = renderTemplate(template.subject, payload.data);
                    const text = renderTemplate(template.text, payload.data);

                    await sgMail.send({
                        to: payload.to,
                        from: process.env.SENDGRID_FROM,
                        subject,
                        text,
                    });

                    console.log("📧 Correo enviado vía Kafka ✅");
                } else if (payload.type === "SMS") {
                    const body = renderTemplate(smsTemplates[payload.template], payload.data);

                    await client.messages.create({
                        body,
                        from: process.env.TWILIO_PHONE,
                        to: payload.to,
                    });

                    console.log("📱 SMS enviado vía Kafka ✅");
                }

            } catch (error) {
                console.error("❌ Error procesando mensaje Kafka:", error);
            }
        },
    });
};

// --- Servidor Express ---
const PORT = process.env.PORT || 8083;
app.listen(PORT, () => {
    console.log(`✅ Servicio de notificaciones corriendo en puerto ${PORT}`);
    startKafkaConsumer(); // Arrancamos Kafka al levantar el microservicio
});
