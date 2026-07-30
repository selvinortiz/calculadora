# Calculadora de Créditos

Aplicación operativa para acreedores construida con Next.js y enfocada en
financiamientos con **interés simple** en quetzales. Permite cotizar un crédito,
registrar un abono a capital, aplicar saldos a favor y preparar recibos, planes
de pago y constancias imprimibles.

**Aplicación:** [calculacuota.com](https://calculacuota.com)

El portal requiere el correo y código de acceso de cada operador. Cada perfil
incluye nombre, correo, empresa y un código almacenado como hash. No incluye un
sistema formal de cuentas: los operadores se configuran en el servidor y reciben
una sesión firmada de 12 horas.

Los cálculos se ejecutan localmente en el navegador. El directorio opcional
guarda organizaciones, clientes y perfiles de financiamiento en el
almacenamiento local del navegador, separado por correo de acceso. Estos datos
no se sincronizan con otros dispositivos ni se transmiten al servidor.

## Flujos

- `/`: portal de operaciones del acreedor.
- `/acceso`: inicio de sesión por correo y código.
- `/financiamiento`: cotización de capital, interés total y cuotas, con un plan
  de pagos fechado para entregar al deudor.
- `/abono-capital`: flujo de cuatro pasos para:
  1. cargar las condiciones del crédito;
  2. registrar un abono independiente o una cuota acompañada de abono;
  3. verificar capital, interés y saldo antes y después;
  4. emitir una simulación o recibo para firma y un plan actualizado de las
     cuotas futuras.
- `/ajustes`: aplica el excedente de un pago a la cuota siguiente sin modificar
  el capital, el interés, la cuota regular ni la fecha final, y genera una
  constancia para el expediente.
- `/directorio`: datos reutilizables de la organización, clientes y condiciones
  originales de financiamientos. Los perfiles completan los formularios, pero
  no representan saldos ni historiales de pago.

Las fechas del abono se conservan como parte del registro. El cálculo utiliza
meses completos según el número de cuota indicado; no calcula interés diario.

> Los resultados son estimaciones informativas. Una simulación no constituye
> comprobante de pago. Un recibo debe ser revisado y firmado por las partes.

## Desarrollo

Requiere Node.js 20.9 o posterior y npm.

```bash
npm ci
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

Sin variables de entorno, el modo de desarrollo habilita únicamente:

- Correo: `demo@creditos.local`
- Código: `1234`

## Configurar operadores

1. Agrega o actualiza un operador:

   ```bash
   npm run portal:hash-code
   ```

   El asistente solicita correo, nombre, empresa y código. Solo el correo es
   obligatorio: si omites el código, genera cuatro palabras; si omites nombre o
   empresa, usa valores adecuados para identificar la sesión. El registro se
   guarda en `.env.local` y el comando imprime el valor listo para pegar en
   Vercel. Si el correo ya existe, solicita confirmación antes de reemplazarlo.

   Para generar únicamente el hash de un código definido por ti, ejecuta
   `npm run portal:hash-code -- codigo-secreto`.

2. Copia `.env.example` a `.env.local` y configura un secreto de sesión de al
   menos 32 caracteres.
3. En Vercel, agrega el valor impreso por el asistente a `PORTAL_USERS`:

   ```dotenv
   PORTAL_USERS=[{"name":"Ana López","email":"ana@empresa.gt","company":"Créditos del Lago","codeHash":"scrypt$..."}]
   ```

Los correos deben ser únicos. Los códigos no se guardan directamente: el
servidor compara hashes `scrypt`. En producción, la aplicación no inicia una
sesión si falta `PORTAL_USERS` o `PORTAL_SESSION_SECRET`.

La URL pública usada para enlaces canónicos, sitemap y vistas previas sociales
es `https://calculacuota.com`. Para usar otro dominio en una instalación
distinta, configura `NEXT_PUBLIC_SITE_URL` con su origen completo.

## Verificación

```bash
npm run check
npm audit --omit=dev
```

`npm run check` ejecuta lint, comprobación estricta de tipos, pruebas y build de
producción. El mismo conjunto se ejecuta en GitHub Actions para cada pull
request y cada push a `main`.

## Estructura

- `app/`: rutas, metadatos, navegación y estilos globales.
- `components/loan-calculator.tsx`: cotizador de interés simple.
- `components/capital-payment-workflow.tsx`: flujo de abono y recálculo.
- `components/payment-adjustment-workflow.tsx`: flujo de aplicación de saldo a
  favor.
- `components/payment-record.tsx`: documento imprimible.
- `components/payment-adjustment-record.tsx`: constancia imprimible del ajuste.
- `components/payment-schedule-document.tsx`: plan de pagos original o
  actualizado, con fechas de vencimiento.
- `lib/finance.ts`: cálculos financieros puros y validación.
- `lib/finance.test.ts`: pruebas de fórmulas, límites y redondeo.
- `next.config.ts`: cabeceras de seguridad y configuración de Next.js.
