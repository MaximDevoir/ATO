import { describe, expect, it } from 'vitest';
import { simplifyUnrealLogLine } from '../src/ATO.helpers';

describe('simplifyUnrealLogLine', () => {
  it('simplifies Unreal timestamps and removes the batch field', () => {
    const input = '[2026.03.10-06.09.49:680][842]LogWorldPartition: Display: WorldPartition initialize took 32.019 ms';
    const output = simplifyUnrealLogLine(input);
    expect(output).toBe('[6:09:49 AM] LogWorldPartition: Display: WorldPartition initialize took 32.019 ms');
  });
  it('handles midnight and padding', () => {
    const input = '[2026.03.10-00.05.07:001][  0]LogInit: Display: Engine is initialized.';
    const output = simplifyUnrealLogLine(input);
    expect(output).toBe('[12:05:07 AM] LogInit: Display: Engine is initialized.');
  });
  it('leaves non-Unreal lines untouched', () => {
    const input = '[UnrealLag] peerAdded | kind=client | id=client-1';
    expect(simplifyUnrealLogLine(input)).toBe(input);
  });
  it('preserves later bracket content', () => {
    const input = '[2026.03.10-13.27.05:222][ 12]LogSomething: Display: Nested [[Tag]] content';
    const output = simplifyUnrealLogLine(input);
    expect(output).toBe('[1:27:05 PM] LogSomething: Display: Nested [[Tag]] content');
  });
});
