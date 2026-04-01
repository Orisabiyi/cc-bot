// ═══════════════════════════════════════════════════
// Winston logger — structured logging for the bot
// ═══════════════════════════════════════════════════

import winston from "winston";

const { combine, timestamp, colorize, printf } = winston.format;

const logFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `${timestamp} [${level}] ${message}${metaStr}`;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), logFormat),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
    }),
    new winston.transports.File({
      filename: "logs/bot.log",
      maxsize: 5_000_000, // 5MB
      maxFiles: 3,
    }),
    new winston.transports.File({
      filename: "logs/errors.log",
      level: "error",
      maxsize: 5_000_000,
      maxFiles: 3,
    }),
  ],
});
