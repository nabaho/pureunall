// Node 의 Buffer 를 브라우저에 — kordoc 는 바이트를 Buffer 로 다룬다
import { Buffer } from 'buffer';
import process from 'process/browser.js';
if (typeof globalThis.Buffer === 'undefined') globalThis.Buffer = Buffer;
if (typeof globalThis.process === 'undefined') globalThis.process = process;
export { Buffer, process };
