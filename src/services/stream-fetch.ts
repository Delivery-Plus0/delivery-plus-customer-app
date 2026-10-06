/**
 * Streaming fetch for long-lived responses (Server-Sent Events). React Native's global fetch can't read
 * a response body incrementally; `expo/fetch` (part of the `expo` package) can, on native and on web.
 * Kept in its own module so tests can replace it.
 */
export { fetch as streamingFetch } from 'expo/fetch';
