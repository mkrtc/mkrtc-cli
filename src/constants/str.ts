export const STR = {
  AddAliasOption:
    "Add new alias.\n" +
    " example:\n" +
    ' mkrtc alias -a alias1="cmd" - "description",alias2=[cmd]\n' +
    " Output:\n" +
    "  alias alias1=cmd\n" +
    "  alias alias2=cmd",
  ReadAliasOption: "Read aliases list",
  RemoveAliasOption: "Remove aliases",
  StateNotInitializedError: "state.json not initialized. Run: mkrtc --init",

  ReadSshOption: "Read saved ssh's list",
  RemoveSshOption: "Remove saved ssh by id",
  SaveSshConnectionOption: "Save connection",
  AliasAlreadyExistsError: (alias: string) =>
    `Alias "${alias}" already exists.`,
  AliasNotFoundError: (alias: string) => `Alias "${alias}" not found`,
} as const;
