// tests/integration/sms.test.js
import { describe, test, expect, jest, beforeAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Mock de Twilio
const mockCreate = jest.fn().mockResolvedValue({
    sid: 'SM_test_message_id_123'
});

jest.unstable_mockModule('twilio', () => ({
    default: jest.fn(() => ({
        messages: {
            create: mockCreate,
        },
    })),
}));

// Mock de SendGrid
jest.unstable_mockModule('@sendgrid/mail', () => ({
    default: {
        setApiKey: jest.fn(),
        send: jest.fn(),
    },
}));

// Mock de Kafka
jest.unstable_mockModule('kafkajs', () => ({
    Kafka: jest.fn(() => ({
        consumer: jest.fn(() => ({
            connect: jest.fn(),
            subscribe: jest.fn(),
            run: jest.fn(),
        })),
    })),
}));

describe('SMS Integration Tests', () => {
    let app;
    let twilioClient;

    beforeAll(async () => {
        // Importar mocks
        const twilioModule = await import('twilio');
        twilioClient = twilioModule.default();

        // Crear app mínima para testing
        app = express();
        app.use(express.json());

        // Cargar templates
        const fs = await import('fs');
        const path = await import('path');

        const smsTemplates = JSON.parse(
            fs.default.readFileSync(path.default.join('src/templates/smsTemplates.json'))
        );

        const renderTemplate = (template, data) =>
            template.replace(/{{(.*?)}}/g, (_, key) => data[key.trim()] || "");

        // Endpoint simplificado para testing
        app.post("/send-sms", async (req, res) => {
            const { to, template, data } = req.body;

            try {
                if (!smsTemplates[template]) {
                    return res.status(400).json({ message: "Plantilla SMS no encontrada" });
                }

                const body = renderTemplate(smsTemplates[template], data);

                const message = await twilioClient.messages.create({
                    body,
                    from: process.env.TWILIO_PHONE,
                    to,
                });

                res.status(200).json({
                    message: "SMS enviado ✅",
                    sid: message.sid,
                });
            } catch (error) {
                res.status(500).json({
                    message: "Error enviando SMS",
                    error: error.message,
                });
            }
        });
    });

    beforeEach(() => {
        mockCreate.mockClear();
    });

    describe('POST /send-sms', () => {
        test('debe enviar SMS de password_recovery correctamente', async () => {
            const response = await request(app)
                .post('/send-sms')
                .send({
                    to: '+573001234567',
                    template: 'password_recovery',
                    data: {
                        name: 'Juan',
                        url: 'https://example.com/reset'
                    }
                });

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('SMS enviado ✅');
            expect(response.body.sid).toBe('SM_test_message_id_123');
            expect(mockCreate).toHaveBeenCalledTimes(1);

            const callArgs = mockCreate.mock.calls[0][0];
            expect(callArgs.to).toBe('+573001234567');
            expect(callArgs.body).toContain('Juan');
            expect(callArgs.body).toContain('https://example.com/reset');
            expect(callArgs.from).toBe(process.env.TWILIO_PHONE);
        });

        test('debe enviar SMS de welcome correctamente', async () => {
            const response = await request(app)
                .post('/send-sms')
                .send({
                    to: '+573009876543',
                    template: 'welcome',
                    data: {
                        name: 'María',
                        url: 'https://example.com/verify'
                    }
                });

            expect(response.status).toBe(200);
            expect(mockCreate).toHaveBeenCalledTimes(1);

            const callArgs = mockCreate.mock.calls[0][0];
            expect(callArgs.body).toContain('Bienvenido');
            expect(callArgs.body).toContain('María');
        });

        test('debe enviar SMS de login_alert correctamente', async () => {
            const response = await request(app)
                .post('/send-sms')
                .send({
                    to: '+573001111111',
                    template: 'login_alert',
                    data: {
                        name: 'Carlos'
                    }
                });

            expect(response.status).toBe(200);
            expect(mockCreate).toHaveBeenCalledTimes(1);

            const callArgs = mockCreate.mock.calls[0][0];
            expect(callArgs.body).toContain('inicio de sesión');
            expect(callArgs.body).toContain('Carlos');
        });

        test('debe enviar SMS de account_verified correctamente', async () => {
            const response = await request(app)
                .post('/send-sms')
                .send({
                    to: '+573002222222',
                    template: 'account_verified',
                    data: {
                        name: 'Ana'
                    }
                });

            expect(response.status).toBe(200);

            const callArgs = mockCreate.mock.calls[0][0];
            expect(callArgs.body).toContain('verificada');
            expect(callArgs.body).toContain('Ana');
        });

        test('debe retornar 400 si la plantilla no existe', async () => {
            const response = await request(app)
                .post('/send-sms')
                .send({
                    to: '+573001234567',
                    template: 'nonexistent_template',
                    data: { name: 'Test' }
                });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Plantilla SMS no encontrada');
            expect(mockCreate).not.toHaveBeenCalled();
        });

        test('debe manejar errores de Twilio', async () => {
            mockCreate.mockRejectedValueOnce(new Error('Twilio API error'));

            const response = await request(app)
                .post('/send-sms')
                .send({
                    to: '+573001234567',
                    template: 'welcome',
                    data: { name: 'Test' }
                });

            expect(response.status).toBe(500);
            expect(response.body.message).toBe('Error enviando SMS');
            expect(response.body.error).toBe('Twilio API error');
        });

        test('debe usar el número FROM correcto', async () => {
            await request(app)
                .post('/send-sms')
                .send({
                    to: '+573001234567',
                    template: 'welcome',
                    data: { name: 'Test', url: 'https://test.com' }
                });

            const callArgs = mockCreate.mock.calls[0][0];
            expect(callArgs.from).toBe(process.env.TWILIO_PHONE);
        });

        test('debe renderizar múltiples variables correctamente', async () => {
            const response = await request(app)
                .post('/send-sms')
                .send({
                    to: '+573001234567',
                    template: 'password_recovery',
                    data: {
                        name: 'Usuario Test',
                        url: 'https://app.com/reset?token=xyz789'
                    }
                });

            expect(response.status).toBe(200);

            const callArgs = mockCreate.mock.calls[0][0];
            expect(callArgs.body).toContain('Usuario Test');
            expect(callArgs.body).toContain('xyz789');
        });

        test('debe retornar el SID de Twilio en la respuesta', async () => {
            mockCreate.mockResolvedValueOnce({ sid: 'SM_custom_sid_456' });

            const response = await request(app)
                .post('/send-sms')
                .send({
                    to: '+573001234567',
                    template: 'welcome',
                    data: { name: 'Test', url: 'https://test.com' }
                });

            expect(response.status).toBe(200);
            expect(response.body.sid).toBe('SM_custom_sid_456');
        });
    });
});