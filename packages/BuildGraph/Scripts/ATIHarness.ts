import type { ATO, Coordinator } from '@maximdevoir/ato';

export async function startLocalATI(ato: ATO, _coordinator: Coordinator, runLabel: string) {
  ato.configureATI({
    enabled: true,
    services: [{ label: runLabel }],
  });

  return {
    async stop() {},
  };
}
