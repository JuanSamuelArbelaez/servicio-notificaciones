// tests/integration/email.test.js
import { describe, test, expect, jest, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Mock de SendGrid antes de importar
jest.unstable_mockModule('@sendgrid/mail', () => ({
    default: {
        setApiKey: jest.fn(),
        send: jest.fn().mockResolvedValue([{ statusCode: 202 }]),
    },
}));

// Mock de Kafka antes de importar
jest.unstable_mockModule('kafkajs', () => ({
    Kafka: jest.fn(() => ({
        consumer: jest.fn(() => ({
            connect: jest.fn(),
            subscribe: jest.fn(),
            run: jest.fn(),
        })),
    })),
}));

// Mock de Twilio
jest.unstable_mockModule('twilio', () => ({
    default: jest.fn(() => ({
        messages: {
            create: jest.fn().mockResolvedValue({ sid: 'test-sid' }),
        },
    })),
}));

describe('Email Integration Tests', () => {
    let app;
    let sgMail;

    beforeAll(async () => {
        // Importar mocks
        const sendgridModule = await import('@sendgrid/mail');
        sgMail = sendgridModule.default;

        // Crear app mínima para testing
        app = express();
        app.use(express.json());

        // Cargar templates
        const fs = await import('fs');
        const path = await import('path');

        const emailTemplates = JSON.parse(
            fs.default.readFileSync(path.default.join('src/templates/emailTemplates.json'))
        );

        const renderTemplate = (template, data) =>
            template.replace(/{{(.*?)}}/g, (_, key) => data[key.trim()] || "");

        // Endpoint simplificado para testing
        app.post("/send-email", async (req, res) => {
            const { to, template, data } = req.body;

            try {
                if (!emailTemplates[template]) {
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

                res.status(200).json({ message: "Correo enviado ✅" });
            } catch (error) {
                res.status(500).json({
                    message: "Error enviando correo",
                    error: error.message,
                });
            }
        });
    });

    beforeEach(() => {
        sgMail.send.mockClear();
    });

    describe('POST /send-email', () => {
        test('debe enviar email de password_recovery correctamente', async () => {
            const response = await request(app)
                .post('/send-email')
                .send({
                    to: 'test@example.com',
                    template: 'password_recovery',
                    data: {
                        name: 'Juan',
                        url: 'https://example.com/reset'
                    }
                });

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Correo enviado ✅');
            expect(sgMail.send).toHaveBeenCalledTimes(1);

            const callArgs = sgMail.send.mock.calls[0][0];
            expect(callArgs.to).toBe('test@example.com');
            expect(callArgs.subject).toContain('Recuperación de contraseña');
            expect(callArgs.text).toContain('Juan');
            expect(callArgs.text).toContain('https://example.com/reset');
        });

        test('debe enviar email de welcome correctamente', async () => {
            const response = await request(app)
                .post('/send-email')
                .send({
                    to: 'newuser@example.com',
                    template: 'welcome',
                    data: {
                        name: 'María',
                        url: 'https://example.com/verify'
                    }
                });

            expect(response.status).toBe(200);
            expect(sgMail.send).toHaveBeenCalledTimes(1);

            const callArgs = sgMail.send.mock.calls[0][0];
            expect(callArgs.subject).toContain('Bienvenido');
            expect(callArgs.text).toContain('María');
        });

        test('debe enviar email de login_alert correctamente', async () => {
            const response = await request(app)
                .post('/send-email')
                .send({
                    to: 'user@example.com',
                    template: 'login_alert',
                    data: {
                        name: 'Carlos'
                    }
                });

            expect(response.status).toBe(200);
            expect(sgMail.send).toHaveBeenCalledTimes(1);

            const callArgs = sgMail.send.mock.calls[0][0];
            expect(callArgs.subject).toContain('inicio de sesión');
        });

        test('debe retornar 400 si la plantilla no existe', async () => {
            const response = await request(app)
                .post('/send-email')
                .send({
                    to: 'test@example.com',
                    template: 'nonexistent_template',
                    data: { name: 'Test' }
                });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Plantilla de correo no encontrada');
            expect(sgMail.send).not.toHaveBeenCalled();
        });

        test('debe manejar errores de SendGrid', async () => {
            sgMail.send.mockRejectedValueOnce(new Error('SendGrid API error'));

            const response = await request(app)
                .post('/send-email')
                .send({
                    to: 'test@example.com',
                    template: 'welcome',
                    data: { name: 'Test' }
                });

            expect(response.status).toBe(500);
            expect(response.body.message).toBe('Error enviando correo');
        });

        test('debe enviar email con múltiples variables', async () => {
            const response = await request(app)
                .post('/send-email')
                .send({
                    to: 'test@example.com',
                    template: 'password_recovery',
                    data: {
                        name: 'Usuario Completo',
                        url: 'https://app.com/reset?token=abc123xyz'
                    }
                });

            expect(response.status).toBe(200);

            const callArgs = sgMail.send.mock.calls[0][0];
            expect(callArgs.text).toContain('Usuario Completo');
            expect(callArgs.text).toContain('abc123xyz');
        });

        test('debe usar el FROM correcto de las variables de entorno', async () => {
            await request(app)
                .post('/send-email')
                .send({
                    to: 'test@example.com',
                    template: 'welcome',
                    data: { name: 'Test' }
                });

            const callArgs = sgMail.send.mock.calls[0][0];
            expect(callArgs.from).toBe(process.env.SENDGRID_FROM);
        });
    });
});