// tests/unit/templates.test.js
import { describe, test, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Templates', () => {
    let emailTemplates;
    let smsTemplates;

    beforeAll(() => {
        // Cargar templates
        emailTemplates = JSON.parse(
            fs.readFileSync(path.join('src/templates/emailTemplates.json'), 'utf8')
        );
        smsTemplates = JSON.parse(
            fs.readFileSync(path.join('src/templates/smsTemplates.json'), 'utf8')
        );
    });

    describe('Email Templates', () => {
        test('debe cargar todos los templates de email', () => {
            expect(emailTemplates).toBeDefined();
            expect(Object.keys(emailTemplates).length).toBeGreaterThan(0);
        });

        test('debe tener template password_recovery', () => {
            expect(emailTemplates.password_recovery).toBeDefined();
            expect(emailTemplates.password_recovery.subject).toBeDefined();
            expect(emailTemplates.password_recovery.text).toBeDefined();
        });

        test('debe tener template password_changed_alert', () => {
            expect(emailTemplates.password_changed_alert).toBeDefined();
            expect(emailTemplates.password_changed_alert.subject).toBe('Tu contraseña ha sido cambiada ✅');
        });

        test('debe tener template login_alert', () => {
            expect(emailTemplates.login_alert).toBeDefined();
            expect(emailTemplates.login_alert.subject).toContain('inicio de sesión');
        });

        test('debe tener template welcome', () => {
            expect(emailTemplates.welcome).toBeDefined();
            expect(emailTemplates.welcome.subject).toContain('Bienvenido');
        });

        test('debe tener template account_verified', () => {
            expect(emailTemplates.account_verified).toBeDefined();
            expect(emailTemplates.account_verified.subject).toContain('verificada');
        });

        test('todos los templates de email deben tener subject y text', () => {
            Object.entries(emailTemplates).forEach(([key, template]) => {
                expect(template.subject).toBeDefined();
                expect(template.text).toBeDefined();
                expect(typeof template.subject).toBe('string');
                expect(typeof template.text).toBe('string');
            });
        });

        test('password_recovery debe contener variables {{name}} y {{url}}', () => {
            const template = emailTemplates.password_recovery;
            expect(template.text).toContain('{{name}}');
            expect(template.text).toContain('{{url}}');
        });
    });

    describe('SMS Templates', () => {
        test('debe cargar todos los templates de SMS', () => {
            expect(smsTemplates).toBeDefined();
            expect(Object.keys(smsTemplates).length).toBeGreaterThan(0);
        });

        test('debe tener template password_recovery', () => {
            expect(smsTemplates.password_recovery).toBeDefined();
            expect(typeof smsTemplates.password_recovery).toBe('string');
        });

        test('debe tener template password_changed_alert', () => {
            expect(smsTemplates.password_changed_alert).toBeDefined();
        });

        test('debe tener template login_alert', () => {
            expect(smsTemplates.login_alert).toBeDefined();
        });

        test('debe tener template welcome', () => {
            expect(smsTemplates.welcome).toBeDefined();
        });

        test('debe tener template account_verified', () => {
            expect(smsTemplates.account_verified).toBeDefined();
        });

        test('todos los templates SMS deben ser strings', () => {
            Object.entries(smsTemplates).forEach(([key, template]) => {
                expect(typeof template).toBe('string');
                expect(template.length).toBeGreaterThan(0);
            });
        });

        test('welcome SMS debe contener variables {{name}} y {{url}}', () => {
            const template = smsTemplates.welcome;
            expect(template).toContain('{{name}}');
            expect(template).toContain('{{url}}');
        });
    });

    describe('Template Consistency', () => {
        test('debe tener los mismos nombres de templates en email y SMS', () => {
            const emailKeys = Object.keys(emailTemplates).sort();
            const smsKeys = Object.keys(smsTemplates).sort();

            expect(emailKeys).toEqual(smsKeys);
        });

        test('debe tener al menos 5 templates', () => {
            expect(Object.keys(emailTemplates).length).toBeGreaterThanOrEqual(5);
            expect(Object.keys(smsTemplates).length).toBeGreaterThanOrEqual(5);
        });
    });
});