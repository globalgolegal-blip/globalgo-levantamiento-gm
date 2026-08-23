export const metadata = {
  title: 'Levantamiento GM · Global Go',
  description: 'Seguimiento del levantamiento de garantía mobiliaria',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{
        margin: 0,
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
      }}>{children}</body>
    </html>
  );
}
