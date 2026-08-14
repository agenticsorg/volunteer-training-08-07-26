export class PlatformApplicationStrategy {
  private constructor(
    public readonly platform: 'gmail' | 'outlook',
    public readonly moveToFolderOnQuarantine: boolean,
    public readonly moveToFolderOnCategory: boolean,
  ) {}

  static gmailDefault(): PlatformApplicationStrategy {
    return new PlatformApplicationStrategy('gmail', false, false);
  }

  static outlookDefault(): PlatformApplicationStrategy {
    return new PlatformApplicationStrategy('outlook', true, false);
  }

  static outlookCategoryOnly(): PlatformApplicationStrategy {
    return new PlatformApplicationStrategy('outlook', false, false);
  }

  static outlookWithFolderMoves(): PlatformApplicationStrategy {
    return new PlatformApplicationStrategy('outlook', true, true);
  }

  toDb(): Record<string, any> {
    return {
      platform: this.platform,
      moveToFolderOnQuarantine: this.moveToFolderOnQuarantine,
      moveToFolderOnCategory: this.moveToFolderOnCategory,
    };
  }
}
