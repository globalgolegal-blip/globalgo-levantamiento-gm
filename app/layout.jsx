export const metadata = {
  title: 'Levantamiento GM · Global Go',
  description: 'Seguimiento del levantamiento de garantía mobiliaria',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
