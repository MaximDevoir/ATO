import type { HarnessCreator } from './HarnessCreator';

export class Harness {
  private readonly harnessCreators: HarnessCreator[] = [];

  addHarness(harnessCreator: HarnessCreator) {
    this.harnessCreators.push(harnessCreator);
  }

  getByName(name: string) {
    return this.harnessCreators.find((creator) => creator.name === name);
  }

  findCompatible(harnessString: string) {
    return this.harnessCreators.find((creator) => creator.canAcceptHarness(harnessString));
  }

  list() {
    return [...this.harnessCreators];
  }
}
