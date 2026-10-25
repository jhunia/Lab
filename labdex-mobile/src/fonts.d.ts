// Per-weight entry points of the @expo-google-fonts packages (importing one weight keeps the others out of the bundle).
declare module '@expo-google-fonts/*' {
  const fonts: Record<string, number>
  export = fonts
}
