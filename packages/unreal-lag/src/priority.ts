export const UNREAL_LAG_PRIORITY_MARKER_BYTES = Object.freeze([
  0xb7, 0x86, 0x12, 0x26, 0xf9, 0x11, 0xe4, 0x4e,
] as const);

export const UNREAL_LAG_PRIORITY_MARKER = Buffer.from(UNREAL_LAG_PRIORITY_MARKER_BYTES);

export function hasPriorityMarker(message: Buffer): boolean {
  return message.length >= UNREAL_LAG_PRIORITY_MARKER.length && message.includes(UNREAL_LAG_PRIORITY_MARKER);
}

export function prependPriorityMarker(payload: Buffer | Uint8Array | string): Buffer {
  const body = Buffer.from(payload);
  return Buffer.concat([UNREAL_LAG_PRIORITY_MARKER, body]);
}

export function joinWithPriorityMarker(...parts: Array<Buffer | Uint8Array | string>): Buffer {
  return Buffer.concat([
    ...parts.slice(0, 1).map((part) => Buffer.from(part)),
    UNREAL_LAG_PRIORITY_MARKER,
    ...parts.slice(1).map((part) => Buffer.from(part)),
  ]);
}
