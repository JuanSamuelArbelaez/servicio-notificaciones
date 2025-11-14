// tests/unit/templateRenderer.test.js
import { describe, test, expect } from '@jest/globals';

// Helper function (copiado de app.js para testing)
const renderTemplate = (template, data) =>
    template.replace(/{{(.*?)}}/g, (_, key) => data[key.trim()] || "");

describe('Template Renderer', () => {
    test('debe reemplazar variable simple', () => {
        const template = 'Hola {{name}}';
        const data = { name: 'Juan' };

        const result = renderTemplate(template, data);

        expect(result).toBe('Hola Juan');
    });

    test('debe reemplazar múltiples variables', () => {
        const template = 'Hola {{name}}, tu código es {{code}}';
        const data = { name: 'María', code: '12345' };

        const result = renderTemplate(template, data);

        expect(result).toBe('Hola María, tu código es 12345');
    });

    test('debe manejar variables con espacios', () => {
        const template = 'Hola {{ name }}, bienvenido';
        const data = { name: 'Pedro' };

        const result = renderTemplate(template, data);

        expect(result).toBe('Hola Pedro, bienvenido');
    });

    test('debe dejar string vacío si variable no existe', () => {
        const template = 'Hola {{name}}, tu email es {{email}}';
        const data = { name: 'Ana' };

        const result = renderTemplate(template, data);

        expect(result).toBe('Hola Ana, tu email es ');
    });

    test('debe manejar template sin variables', () => {
        const template = 'Este es un mensaje fijo';
        const data = { name: 'Test' };

        const result = renderTemplate(template, data);

        expect(result).toBe('Este es un mensaje fijo');
    });

    test('debe manejar template con variables repetidas', () => {
        const template = 'Hola {{name}}, {{name}} es tu nombre';
        const data = { name: 'Carlos' };

        const result = renderTemplate(template, data);

        expect(result).toBe('Hola Carlos, Carlos es tu nombre');
    });

    test('debe manejar números en los datos', () => {
        const template = 'Tu código OTP es {{otp}}';
        const data = { otp: 123456 };

        const result = renderTemplate(template, data);

        expect(result).toBe('Tu código OTP es 123456');
    });

    test('debe manejar URLs en los datos', () => {
        const template = 'Haz clic aquí: {{url}}';
        const data = { url: 'https://example.com/reset?token=abc123' };

        const result = renderTemplate(template, data);

        expect(result).toBe('Haz clic aquí: https://example.com/reset?token=abc123');
    });

    test('debe manejar template complejo de password recovery', () => {
        const template = 'Hola {{name}},\n\nPara restablecer tu contraseña, visita: {{url}}\n\nSaludos';
        const data = {
            name: 'Usuario Test',
            url: 'https://app.com/reset'
        };

        const result = renderTemplate(template, data);

        expect(result).toContain('Usuario Test');
        expect(result).toContain('https://app.com/reset');
    });

    test('debe manejar caracteres especiales en datos', () => {
        const template = 'Mensaje: {{message}}';
        const data = { message: 'Hola! ¿Cómo estás? 🎉' };

        const result = renderTemplate(template, data);

        expect(result).toBe('Mensaje: Hola! ¿Cómo estás? 🎉');
    });

    test('debe ser case-sensitive con nombres de variables', () => {
        const template = 'Hola {{Name}} y {{name}}';
        const data = { name: 'juan' };

        const result = renderTemplate(template, data);

        expect(result).toBe('Hola  y juan'); // Name queda vacío
    });

    test('debe manejar objeto vacío de datos', () => {
        const template = 'Hola {{name}}';
        const data = {};

        const result = renderTemplate(template, data);

        expect(result).toBe('Hola ');
    });
});