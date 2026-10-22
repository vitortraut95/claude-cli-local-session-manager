/** The port this API listens on — also given to sessions that call it back (e.g. a test marking
 *  itself done). */
export const API_PORT = Number(process.env.PORT ?? 58231);
