import winston from 'winston';
import { config } from './config';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const prettyFormat = printf(({ level, message, timestamp: ts, stack }) => {
  const base = `${ts}  [${level}]  ${message}`;
  return stack ? `${base}\n${stack}` : base;
});

export const logger = winston.createLogger({
  level: config.logLevel,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    colorize({ all: true }),
    prettyFormat,
  ),
  transports: [new winston.transports.Console()],
});
