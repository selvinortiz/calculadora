# Calculadora de Créditos

Portal operativo en Next.js para modelar créditos de interés simple en quetzales. Next.js se despliega en Vercel; Supabase aporta Postgres durable, Auth y Row Level Security.

La aplicación registra tres operaciones: originación de un financiamiento, abono a capital y ajuste de un pago con saldo a favor. Las cotizaciones siguen siendo editables hasta usar una acción explícita de registro. Cada operación registrada recibe un número transaccional y un snapshot estructurado para reimpresión.

> No es un libro mayor completo de cuotas. Las cuotas ordinarias no se registran aquí, por lo que el sistema solicita el número de cuota o un capital de estado de cuenta y no afirma mora, saldo exigible ni monto al día.

## Rutas principales

- `/acceso`: inicio de sesión con correo y contraseña de Supabase.
- `/financiamiento`: cotización y registro atómico de un financiamiento.
- `/abono-capital`: recálculo desde el plan vigente y registro de un abono.
- `/ajustes`: crédito de una sola cuota sin cambiar el plan de capital.
- `/clientes`: listado, búsqueda y perfiles de clientes.
- `/financiamientos`: listado, búsqueda y detalle de financiamientos registrados.
- `/configuracion`: organización y numeración de documentos.
- `/financiamientos/[id]`: condiciones originales, plan vigente, cronología y reimpresión de snapshots.
- `/configuracion/accesos`: administración de operadores, solo para propietarios.
- `/configuracion/auditoria`: consulta y exportación CSV de eventos, solo para propietarios.

## Desarrollo local

Requiere Node.js 20.9+, npm, Docker y Supabase CLI (incluida como dependencia de desarrollo).

```bash
npm ci
npm run supabase:start
npm run supabase:reset
npx supabase status
```

Copia `.env.example` a `.env.local`. Usa la URL, publishable/anon key y service-role key mostradas por `supabase status`. La service-role key es exclusivamente de servidor y nunca debe tener el prefijo `NEXT_PUBLIC_`.

Después de `supabase:reset`, el seed local permite entrar con `owner@local.test` y `Local-demo-12345`. El seed no se aplica al proyecto hospedado durante el flujo normal de migraciones.

```bash
npm run supabase:bootstrap-owner -- \
  --email owner@example.com \
  --password 'una-clave-larga-123' \
  --name 'Nombre del propietario' \
  --organization 'Nombre de la organización'
npm run dev
```

El bootstrap es intencionalmente de una sola ejecución para proyectos sin seed, especialmente producción: crea la organización, el propietario y las series `FIN`, `REC` y `AJU`. Después, el propietario crea operadores desde `/configuracion/accesos`.

### Base de datos

- Las migraciones versionadas están en `supabase/migrations/`.
- `npm run supabase:reset` reconstruye la base desde cero.
- `npm run supabase:test` ejecuta las pruebas pgTAP de restricciones, RLS y RPC.
- `npm run supabase:types` regenera `lib/database.types.ts` contra la pila local.
- El seed no importa datos del antiguo `localStorage`.

El dinero se persiste como centavos enteros; las tasas como `numeric(9,6)`. La versión inicial de cálculo es `simple-interest-v2-cents`: los totales usan redondeo decimal half-up y las cuotas ordinarias distribuyen centavos hacia abajo, dejando el residuo positivo en la cuota final. El propietario puede corregir únicamente la operación registrada más reciente, conservando su número; la corrección regenera el snapshot y queda registrada con su estado anterior y posterior en auditoría. Para corregir una operación anterior se anulan primero sus dependencias, en orden inverso. Los números anulados no se reutilizan.

Las operaciones financieras, clientes, configuración y auditoría se escriben mediante RPC exclusivos del servidor. La clave de sesión de un operador conserva acceso de lectura por RLS, pero no puede invocar RPC financieros ni modificar tablas de negocio directamente.

## Acceso sin correo transaccional

El signup público (`auth.enable_signup = false`), la confirmación, el cambio seguro basado en correo y la notificación de contraseña cambiada están desactivados. El proveedor de correo permanece habilitado únicamente para autenticar correo + contraseña; no existen invitaciones, magic links, verificación ni recuperación por correo.

1. El propietario crea al operador.
2. La pantalla muestra una contraseña temporal una sola vez.
3. El operador debe cambiarla al primer inicio de sesión.
4. Un usuario autenticado puede cambiar su propia contraseña sin correo.
5. Si la olvida, el propietario genera otra contraseña temporal desde la página de accesos.

Desactiva usuarios en lugar de eliminar identidades históricas. Archiva clientes referenciados en lugar de borrarlos.

## Vercel y producción

Configura estas variables únicamente en Production:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SITE_URL=https://calculacuota.com
```

No copies las credenciales de producción a Vercel Preview. Sin ellas, las rutas protegidas redirigen a `/acceso` y muestran que el almacenamiento durable no está disponible; no recurren a almacenamiento temporal.

Antes del corte:

1. crea un único proyecto Supabase de producción y aplica todas las migraciones;
   en Auth, conserva desactivados signup público, confirmación, cambio seguro basado en correo y la notificación de contraseña cambiada;
2. ejecuta el bootstrap del propietario contra ese proyecto;
3. prueba inicio, cambio de contraseña, operador y propietario;
4. prueba los tres registros, recarga en otra sesión y reimprime snapshots;
5. configura Production en Vercel y despliega;
6. conserva el `localStorage` antiguo para consulta manual; la aplicación no lo importa ni lo elimina.
7. confirma en Supabase Auth que el JWT sea de una hora y que los límites de inicio de sesión estén activos;
8. configura alertas para errores 5xx, fallos de Auth, fallos de base de datos y migraciones;
9. registra quién revisará `/configuracion/auditoria` y con qué frecuencia.

Si el corte falla, vuelve al deployment anterior de Vercel. No elimines operaciones ya escritas en Supabase: consérvalas para conciliación.

### Backups

Usa el nivel gratuito solo durante desarrollo. Antes de depender de estos registros en producción:

1. activa backups administrados y PITR en el proyecto Supabase;
2. documenta la retención y las personas autorizadas para restaurar;
3. ejecuta un simulacro de restauración en un proyecto aislado antes del corte y al menos trimestralmente;
4. concilia conteos, números documentales, saldos de capital y snapshots después de cada simulacro;
5. registra el resultado del simulacro fuera de la base restaurada.

El rollback de Vercel no reemplaza una restauración de base de datos y nunca debe eliminar operaciones ya registradas.

## Verificación

```bash
npm run supabase:reset
npm run supabase:test
npm run check
npm run test:e2e
npm audit --omit=dev
```

CI inicia Supabase, reconstruye migraciones, ejecuta pgTAP/RLS y luego lint, TypeScript, Vitest, build y auditoría de dependencias de producción.
