export enum HarnessResultState {
  Success = 'Success',
  Fail = 'Fail',
  Skip = 'Skip',
}

export class HarnessCreationResult {
  result: HarnessResultState = HarnessResultState.Success;
  readonly logs: string[] = [];
  readonly warnings: string[] = [];
  readonly errors: string[] = [];

  addLog(message: string) {
    this.logs.push(message);
  }

  addWarning(message: string) {
    this.warnings.push(message);
  }

  addError(message: string, setResultToFail = true) {
    this.errors.push(message);
    if (setResultToFail) {
      this.result = HarnessResultState.Fail;
    }
  }

  setResult(result: HarnessResultState) {
    this.result = result;
  }
}
