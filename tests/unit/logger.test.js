// tests/unit/logger.test.js
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { logger } from '../../src/Logger.js';

describe('Logger', () => {
    let consoleLogSpy;

    beforeEach(() => {
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
    });

    test('debe loggear nivel info correctamente', () => {
        logger.info('test-logger', 'Test message', { extra: 'data' });

        expect(consoleLogSpy).toHaveBeenCalledTimes(1);
        const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);

        expect(loggedData.level).toBe('info');
        expect(loggedData.logger).toBe('test-logger');
        expect(loggedData.message).toBe('Test message');
        expect(loggedData.extra).toBe('data');
        expect(loggedData.timestamp).toBeDefined();
    });

    test('debe loggear nivel debug correctamente', () => {
        logger.debug('debug-logger', 'Debug message');

        expect(consoleLogSpy).toHaveBeenCalledTimes(1);
        const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);

        expect(loggedData.level).toBe('debug');
        expect(loggedData.logger).toBe('debug-logger');
        expect(loggedData.message).toBe('Debug message');
    });

    test('debe loggear nivel warn correctamente', () => {
        logger.warn('warn-logger', 'Warning message', { code: 'WARN001' });

        expect(consoleLogSpy).toHaveBeenCalledTimes(1);
        const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);

        expect(loggedData.level).toBe('warn');
        expect(loggedData.logger).toBe('warn-logger');
        expect(loggedData.message).toBe('Warning message');
        expect(loggedData.code).toBe('WARN001');
    });

    test('debe loggear nivel error correctamente', () => {
        logger.error('error-logger', 'Error message', {
            error: 'Something went wrong',
            stack: 'Error stack trace'
        });

        expect(consoleLogSpy).toHaveBeenCalledTimes(1);
        const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);

        expect(loggedData.level).toBe('error');
        expect(loggedData.logger).toBe('error-logger');
        expect(loggedData.message).toBe('Error message');
        expect(loggedData.error).toBe('Something went wrong');
    });

    test('debe incluir timestamp en formato ISO', () => {
        logger.info('test', 'message');

        const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
        const timestamp = new Date(loggedData.timestamp);

        expect(timestamp.toISOString()).toBe(loggedData.timestamp);
        expect(timestamp.getTime()).not.toBeNaN();
    });

    test('debe incluir thread (process ID)', () => {
        logger.info('test', 'message');

        const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);

        expect(loggedData.thread).toBe(process.pid.toString());
    });

    test('debe manejar metadata vacía', () => {
        logger.info('test', 'message without meta');

        expect(consoleLogSpy).toHaveBeenCalledTimes(1);
        const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);

        expect(loggedData.level).toBe('info');
        expect(loggedData.message).toBe('message without meta');
    });

    test('debe producir JSON válido', () => {
        logger.info('test', 'message', { key: 'value', number: 42 });

        const output = consoleLogSpy.mock.calls[0][0];

        expect(() => JSON.parse(output)).not.toThrow();
    });
});