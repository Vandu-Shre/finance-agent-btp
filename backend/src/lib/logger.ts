import winston from 'winston';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
  format: isProduction
    ? winston.format.json()
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
  transports: [new winston.transports.Console()],
});
