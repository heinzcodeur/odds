import { createApiMiddleware } from '../../database.js';

export default createApiMiddleware();

export const config = { maxDuration: 300 };
