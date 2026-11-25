# Integración IventIA ↔ SAE: facturación automática · Historias de usuario

| Historia | Título | Fase | Como | Necesita |
|---|---|---|---|---|
| HU-01 | Catálogos espejo · Sincronizar IventIA → SAE | Preparar | Contador | — |
| HU-02 | Facturar · Pago primero (PUE) automática | Facturar | Expositor | HU-01 |
| HU-03 | Facturar · Antes del pago (PPD) y complemento de pago | Facturar | Coordinador SA | HU-01 |
| HU-04 | Anticipos · Stand y servicios | Cobrar | Contador | HU-02 |
| HU-05 | Ajustes · Refacturación, nota de crédito y reembolso | Ajustar | Contador | HU-02 |
| HU-06 | Cierre contable · Conciliación IventIA–SAE–COI | Cerrar | Gerente de Contabilidad | HU-02, HU-04 |

## Preparar · Objetos espejo en SAE

### HU-01 · Catálogos espejo · Sincronizar IventIA → SAE

Como **Contador**, quiero **que clientes, eventos, recursos y precios de IventIA existan igual en SAE**, para **no volver a capturar nada al facturar**.

- **Flujo actual (AS IS):** Contabilidad da de alta al cliente y los conceptos en SAE cuando llega la solicitud; las claves de SAE no viven en IventIA y los nombres no coinciden.
- **Flujo futuro (TO BE):** Cada alta o cambio en IventIA deja un evento en la bitácora de integración; el conector lo crea o actualiza en SAE y guarda la clave SAE en el objeto de IventIA. Los errores quedan en una bandeja.
- **Módulo:** IventIA › Configuración › Integración SAE · Expo Santa Fe

**Pasos**

*Detectar*
1. **IventIA (sistema):** Registra en la bitácora de integración el alta o cambio de cliente, evento, recurso o lista de precios
*Mapear*
2. **Conector IventIA–SAE:** Toma el evento y busca su espejo en SAE por la llave de integración (RFC, código de recurso, código de evento) _(Conector (servicio Windows junto al servidor de SAE))_
3. **Conector IventIA–SAE:** Valida obligatorios: RFC, régimen fiscal, C.P., uso CFDI, clave SAT de producto/servicio y de unidad
4. **Conector IventIA–SAE:** ¿Los datos están completos y son válidos?
5. **Contador:** Corrige el dato en el catálogo de IventIA o en la tabla de equivalencias SAT _(IventIA › Bandeja de integración)_
*Registrar en SAE*
6. **Aspel SAE / PAC (sistema):** Da de alta o actualiza el cliente, el producto/servicio o la obra/proyecto del evento
*Confirmar*
7. **Conector IventIA–SAE:** Guarda la clave SAE en el objeto de IventIA y lo marca Sincronizado
8. **IventIA (sistema):** Avisa al Contador los errores de sincronización pendientes

**Criterios de aceptación**

- Toda alta o cambio deja un evento en la bitácora con llave de idempotencia
- El objeto de IventIA guarda su clave SAE y la fecha de sincronización
- Un error no detiene la cola: queda en la bandeja con el motivo
- Reintentar no duplica clientes ni productos en SAE

**Particularidades**

- La llave del cliente es el RFC (+ id de IventIA para RFC genéricos XAXX010101000 / XEXX010101000)
- Los recursos de IventIA se mapean a productos/servicios con clave SAT y unidad SAT

**Necesita:** nada previo
**Habilita:** HU-02 Facturar · Pago primero (PUE) automática, HU-03 Facturar · Antes del pago (PPD) y complemento de pago
**Autorizan:** Gerente de Contabilidad · Expo Santa Fe; Gerente de Administración y Finanzas · Expo Santa Fe; Gerente de Sistemas · Expo Santa Fe; Consumatum
**Dónde vive:** Conector (servicio Windows junto al servidor de SAE), IventIA › Bandeja de integración
**Documento autorizado:** https://drive.google.com/file/d/14qFtupXkWm03CsUR6mYtzxxBH_gAPJ7L/view

## Facturar · CFDI de ingreso

### HU-02 · Facturar · Pago primero (PUE) automática

Como **Expositor**, quiero **pedir mi factura en el portal y recibirla timbrada sin esperar**, para **cerrar mi trámite fiscal sin correos ni llamadas**.

- **Flujo actual (AS IS):** HU-SA-08: el Contador abre la bandeja, valida RFC, genera el CFDI en SAE con los datos de la prefactura, timbra y adjunta a mano el XML y el PDF.
- **Flujo futuro (TO BE):** La solicitud se valida sola, el conector crea el documento en SAE con las partidas de la orden y el pago, SAE timbra, y el XML/PDF regresan a IventIA y al portal. El Contador sólo ve excepciones.
- **Módulo:** Portal del expositor · IventIA › Contabilidad · Expo Santa Fe

**Pasos**

*Solicitar*
1. **Expositor:** Pide la factura de su solicitud pagada y elige el cliente de facturación _(Portal del expositor › Mis solicitudes)_
2. **IventIA (sistema):** Crea la solicitud de factura con la foto de datos fiscales y la prefactura
*Validar*
3. **IventIA (sistema):** Valida RFC, razón social, régimen y C.P. contra la constancia de situación fiscal
4. **IventIA (sistema):** ¿Los datos fiscales son válidos?
5. **Expositor:** Corrige sus datos fiscales (la solicitud queda bloqueada) _(Portal del expositor › Mis solicitudes)_
*Registrar en SAE*
6. **Conector IventIA–SAE:** Asegura cliente, evento y recursos en SAE (catálogos espejo)
7. **Conector IventIA–SAE:** Crea la factura en SAE con las partidas de la orden, el evento y la serie de la organización
8. **Aspel SAE / PAC (sistema):** Genera el cargo en cuentas por cobrar y aplica el pago registrado en IventIA
*Timbrar*
9. **Aspel SAE / PAC (sistema):** Timbra el CFDI 4.0 (PUE, forma de pago del cobro) con el PAC
10. **Conector IventIA–SAE:** ¿Timbró sin error?
11. **Contador:** Atiende el rechazo del PAC en la bandeja de excepciones y reintenta _(IventIA › Contabilidad)_
*Entregar*
12. **Conector IventIA–SAE:** Sube XML y PDF a IventIA; valida sello SAT y que el UUID no esté duplicado
13. **IventIA (sistema):** Marca la solicitud Facturada y la orden facturada
14. **IventIA (sistema):** Avisa al expositor (correo y portal) y al coordinador
15. **Expositor:** Descarga el XML y el PDF desde el portal _(Portal del expositor › Mis solicitudes)_

**Criterios de aceptación**

- Sólo se factura lo pagado (PUE) o lo autorizado (PPD)
- Sólo se acepta XML con sello SAT y UUID no duplicado
- Tiempo objetivo: menos de 10 minutos de la solicitud al CFDI en el portal
- Toda falla del PAC llega a la bandeja de excepciones del Contador
- El flujo es idéntico para SA, KIU y A&B (cambia la serie)

**Necesita:** HU-01 Catálogos espejo · Sincronizar IventIA → SAE
**Habilita:** HU-04 Anticipos · Stand y servicios, HU-05 Ajustes · Refacturación, nota de crédito y reembolso, HU-06 Cierre contable · Conciliación IventIA–SAE–COI
**Autorizan:** Gerente de Contabilidad · Expo Santa Fe; Gerente de Administración y Finanzas · Expo Santa Fe; Gerente de Sistemas · Expo Santa Fe; Consumatum
**Dónde vive:** Portal del expositor › Mis solicitudes, IventIA › Contabilidad
**Documento autorizado:** https://drive.google.com/file/d/14qFtupXkWm03CsUR6mYtzxxBH_gAPJ7L/view

### HU-03 · Facturar · Antes del pago (PPD) y complemento de pago

Como **Coordinador SA**, quiero **autorizar facturas antes del pago y que el complemento salga solo al cobrar**, para **dar crédito a clientes confiables sin perder el control fiscal**.

- **Flujo actual (AS IS):** La factura previa se autoriza por correo; el complemento de pago se emite a mano y a veces no se emite.
- **Flujo futuro (TO BE):** El coordinador autoriza en IventIA (queda auditado), SAE emite la factura PPD con su cargo en cuentas por cobrar y, al registrarse el pago en IventIA, SAE emite y timbra el complemento de pago (REP).
- **Módulo:** IventIA › Mi espacio · Contabilidad · Expo Santa Fe

**Pasos**

*Solicitar*
1. **Expositor:** Pide factura antes de pagar (cliente habilitado en el evento) _(Portal del expositor › Mis solicitudes)_
*Autorizar*
2. **Coordinador SA:** Autoriza la factura previa al pago _(IventIA › Mi espacio)_
*Facturar*
3. **Conector IventIA–SAE:** Crea la factura PPD (forma de pago 99) en SAE con su cargo en cuentas por cobrar
4. **Aspel SAE / PAC (sistema):** Timbra el CFDI y lo regresa a IventIA
5. **IventIA (sistema):** Publica XML y PDF en el portal y avisa al expositor
*Cobrar*
6. **Expositor:** Paga en línea, por transferencia o en piso
7. **Coordinador SA:** Registra o concilia el pago en IventIA
*Complementar*
8. **Conector IventIA–SAE:** Registra el abono en cuentas por cobrar de SAE ligado a la factura
9. **Aspel SAE / PAC (sistema):** Timbra el complemento de pago (REP 2.0)
10. **IventIA (sistema):** Adjunta el REP a la solicitud y avisa al expositor

**Criterios de aceptación**

- Toda factura sin pago sale con PPD y forma de pago 99
- La autorización queda auditada con quién y cuándo
- Cada pago registrado genera su REP ligado al UUID de la factura
- El saldo insoluto en IventIA y SAE es el mismo

**Necesita:** HU-01 Catálogos espejo · Sincronizar IventIA → SAE
**Habilita:** el cierre del flujo
**Autorizan:** Gerente de Contabilidad · Expo Santa Fe; Gerente de Administración y Finanzas · Expo Santa Fe; Gerente de Sistemas · Expo Santa Fe; Consumatum
**Dónde vive:** Portal del expositor › Mis solicitudes, IventIA › Mi espacio
**Documento autorizado:** https://drive.google.com/file/d/14qFtupXkWm03CsUR6mYtzxxBH_gAPJ7L/view

## Cobrar · Anticipos y cuentas por cobrar

### HU-04 · Anticipos · Stand y servicios

Como **Contador**, quiero **que los anticipos se facturen y apliquen solos**, para **que el saldo del expositor sea el mismo en IventIA, SAE y COI**.

- **Flujo actual (AS IS):** El anticipo se cobra en IventIA pero en SAE se factura aparte y se aplica a mano; los saldos no cuadran.
- **Flujo futuro (TO BE):** Cada anticipo genera su CFDI de anticipo; la factura final relaciona el anticipo (tipo 07) y SAE salda la cuenta por cobrar con el egreso por aplicación del anticipo.
- **Módulo:** IventIA › Solicitudes · Contabilidad · Expo Santa Fe

**Pasos**

*Cobrar anticipo*
1. **Coordinador SA:** Registra el anticipo del expositor en la orden _(IventIA › Solicitudes)_
*Facturar anticipo*
2. **Conector IventIA–SAE:** Registra el anticipo en cuentas por cobrar de SAE y genera el CFDI de anticipo (serie FxANT, clave 84111506)
3. **Aspel SAE / PAC (sistema):** Timbra el CFDI de anticipo y lo devuelve a IventIA
*Facturar total*
4. **Coordinador SA:** Cierra la orden con el total del evento
5. **Conector IventIA–SAE:** Crea la factura por el total relacionando el anticipo (CFDI relacionado 07)
*Aplicar anticipo*
6. **Aspel SAE / PAC (sistema):** Emite el egreso por aplicación del anticipo (serie NCxANT, relación 07) y salda la cuenta por cobrar
7. **IventIA (sistema):** Muestra al expositor su estado de cuenta con el anticipo aplicado
8. **Contador:** Revisa que el saldo de la orden y el de SAE coincidan

**Criterios de aceptación**

- Cada anticipo tiene su CFDI de anticipo
- La factura final relaciona el anticipo (tipo 07)
- El egreso por aplicación salda la cuenta por cobrar
- No se puede aplicar más anticipo que el cobrado

**Necesita:** HU-02 Facturar · Pago primero (PUE) automática
**Habilita:** HU-06 Cierre contable · Conciliación IventIA–SAE–COI
**Autorizan:** Gerente de Contabilidad · Expo Santa Fe; Gerente de Administración y Finanzas · Expo Santa Fe; Gerente de Sistemas · Expo Santa Fe; Consumatum
**Dónde vive:** IventIA › Solicitudes
**Documento autorizado:** https://drive.google.com/file/d/14qFtupXkWm03CsUR6mYtzxxBH_gAPJ7L/view

## Ajustar · Cancelación, nota de crédito, reembolso

### HU-05 · Ajustes · Refacturación, nota de crédito y reembolso

Como **Contador**, quiero **ejecutar refacturaciones, notas de crédito y reembolsos desde IventIA**, para **que cada ajuste quede ligado a la factura original y autorizado**.

- **Flujo actual (AS IS):** Se pide por correo con carta; el Contador cancela y emite en SAE, y la nota de crédito no queda ligada a la solicitud en IventIA.
- **Flujo futuro (TO BE):** El expositor lo pide en el portal con su carta, se autoriza en IventIA y el conector ejecuta en SAE la sustitución (motivo 01, relación 04) o la nota de crédito (relación 01 bonificación, 03 devolución) y actualiza cuentas por cobrar.
- **Módulo:** Portal del expositor · IventIA › Contabilidad · Expo Santa Fe

**Pasos**

*Solicitar*
1. **Expositor:** Pide cancelación, cambio de datos o reembolso y adjunta su carta _(Portal del expositor › Mis solicitudes)_
*Autorizar*
2. **Coordinador SA:** Revisa la carta, el motivo y el plazo (5 días antes del montaje)
3. **Contador:** Autoriza el ajuste; la nota de crédito no excede lo pagado
*Ejecutar en SAE*
4. **Conector IventIA–SAE:** Refacturación: cancela con motivo 01 y emite el CFDI sustituto (relación 04)
5. **Conector IventIA–SAE:** Nota de crédito: genera en SAE la devolución (relación 03) o la bonificación (relación 01) ligada a la factura
6. **Aspel SAE / PAC (sistema):** Timbra y actualiza cuentas por cobrar
*Cerrar*
7. **Contador:** Programa el reembolso (10 días hábiles) y adjunta el comprobante
8. **IventIA (sistema):** Liga el ajuste a la solicitud original y avisa al expositor y al coordinador

**Criterios de aceptación**

- La nota de crédito no excede lo pagado
- La cancelación usa el motivo SAT correcto y relaciona el sustituto
- Reembolso a 10 días hábiles de aprobado
- Cancelación de lo pagado se pide 5 días antes del montaje

**Necesita:** HU-02 Facturar · Pago primero (PUE) automática
**Habilita:** el cierre del flujo
**Autorizan:** Gerente de Contabilidad · Expo Santa Fe; Gerente de Administración y Finanzas · Expo Santa Fe; Gerente de Sistemas · Expo Santa Fe; Consumatum
**Dónde vive:** Portal del expositor › Mis solicitudes
**Documento autorizado:** https://drive.google.com/file/d/14qFtupXkWm03CsUR6mYtzxxBH_gAPJ7L/view

## Cerrar · Conciliación y pólizas

### HU-06 · Cierre contable · Conciliación IventIA–SAE–COI

Como **Gerente de Contabilidad**, quiero **ver cada día lo facturado, cobrado y pendiente por evento conciliado contra SAE**, para **cerrar el mes sin sorpresas**.

- **Flujo actual (AS IS):** La conciliación es mensual y en Excel; las diferencias se descubren al cierre.
- **Flujo futuro (TO BE):** Cada noche el conector compara IventIA contra SAE, la IA propone la causa de cada diferencia, el Contador la resuelve y SAE envía las pólizas a COI.
- **Módulo:** IventIA › Contabilidad › Conciliación · Expo Santa Fe

**Pasos**

*Conciliar*
1. **Conector IventIA–SAE:** Compara órdenes, pagos y facturas de IventIA contra SAE (folio, UUID, importe y saldo)
2. **IventIA (sistema):** Explica cada diferencia y propone la causa
3. **Contador:** Resuelve las diferencias del día _(IventIA › Contabilidad)_
*Contabilizar*
4. **Aspel SAE / PAC (sistema):** Genera las pólizas de ventas, cobranza y anticipos en COI (interfaz SAE–COI por rango de documentos)
5. **Gerente de Contabilidad:** Revisa y autoriza las pólizas del periodo
*Reportar*
6. **IventIA (sistema):** Publica el tablero de facturación por evento: facturado, cobrado, anticipos y pendientes
7. **IventIA (sistema):** Avisa el cierre del día a Contabilidad y Finanzas

**Criterios de aceptación**

- Conciliación diaria automática con reporte de diferencias
- Cada diferencia tiene responsable y causa
- Las pólizas llegan a COI por la interfaz SAE–COI
- Tablero por evento: facturado, cobrado, anticipos, notas de crédito

**Necesita:** HU-02 Facturar · Pago primero (PUE) automática, HU-04 Anticipos · Stand y servicios
**Habilita:** el cierre del flujo
**Autorizan:** Gerente de Contabilidad · Expo Santa Fe; Gerente de Administración y Finanzas · Expo Santa Fe; Gerente de Sistemas · Expo Santa Fe; Consumatum
**Dónde vive:** IventIA › Contabilidad
**Documento autorizado:** https://drive.google.com/file/d/14qFtupXkWm03CsUR6mYtzxxBH_gAPJ7L/view

---

# Catálogos espejo · Sincronizar IventIA → SAE

**Para qué:** Que todo cliente, evento, recurso y precio que se factura en IventIA exista igual en SAE, con su clave SAE guardada en IventIA, antes de que se pida una factura.
**Hoy (AS IS):** Contabilidad da de alta al cliente y los conceptos en SAE cuando llega la solicitud; las claves de SAE no viven en IventIA y los nombres no coinciden.
**Con la solución (TO BE):** Cada alta o cambio en IventIA deja un evento en la bitácora de integración; el conector lo crea o actualiza en SAE y guarda la clave SAE en el objeto de IventIA. Los errores quedan en una bandeja.

**Etapas:** Detectar → Mapear → Registrar en SAE → Confirmar  
**Duración estimada:** 2 día(s) hábil(es), termina el 2027-01-12

## Mapa de historias

| # | Historia | Rol | Etapa | Necesita | Habilita |
|---|---|---|---|---|---|
| HU-01 | ¿Los datos están completos y son válidos? | Conector IventIA–SAE | Mapear | — | — |
| HU-02 | Corrige el dato en el catálogo de IventIA o en la tabla de equivalencias SAT | Contador | Mapear | — | — |

## HU-01 · ¿Los datos están completos y son válidos?

**Como** Conector IventIA–SAE, **quiero** decidir ¿Los datos están completos y son válidos? **para** Que todo cliente, evento, recurso y precio que se factura en IventIA exista igual en SAE, con su clave SAE guardada en IventIA, antes de que se pida una factura..

*Etapa:* Mapear · *Tipo:* Decisión

**Flujo**
- Recibe — Conector IventIA–SAE: Valida obligatorios: RFC, régimen fiscal, C.P., uso CFDI, clave SAT de producto/servicio y de unidad
- Hace — Conector IventIA–SAE: ¿Los datos están completos y son válidos?
- Sigue — Aspel SAE / PAC (sistema): Da de alta o actualiza el cliente, el producto/servicio o la obra/proyecto del evento
- Sigue — Conector IventIA–SAE: Guarda la clave SAE en el objeto de IventIA y lo marca Sincronizado
- Sigue — IventIA (sistema): Avisa al Contador los errores de sincronización pendientes
- Sigue — Contador: Si rechaza: regresa a «Corrige el dato en el catálogo de IventIA o en la tabla de equivalencias SAT» _(IventIA › Bandeja de integración)_

**Criterios de aceptación**
- Desde su bandeja puede decidir «¿Los datos están completos y son válidos?».
- Si autoriza continúa a «Da de alta o actualiza el cliente, el producto/servicio o la obra/proyecto del evento»; si rechaza regresa a «Corrige el dato en el catálogo de IventIA o en la tabla de equivalencias SAT» con el motivo.
- Queda registro de quién lo hizo y cuándo.

**Necesita:** nada previo · **Habilita:** el cierre del proceso

## HU-02 · Corrige el dato en el catálogo de IventIA o en la tabla de equivalencias SAT

**Como** Contador, **quiero** corregir el dato en el catálogo de IventIA o en la tabla de equivalencias SAT **para** Que todo cliente, evento, recurso y precio que se factura en IventIA exista igual en SAE, con su clave SAE guardada en IventIA, antes de que se pida una factura..

*Etapa:* Mapear · *Tipo:* Tarea · *Atención:* 24 h

**Flujo**
- Hace — Contador: Corrige el dato en el catálogo de IventIA o en la tabla de equivalencias SAT _(IventIA › Bandeja de integración)_
- Hace — Contador: Al guardar, el cambio vuelve a la bitácora (paso 1). _(IventIA › Bandeja de integración)_
- Sigue — Aspel SAE / PAC (sistema): Da de alta o actualiza el cliente, el producto/servicio o la obra/proyecto del evento
- Sigue — Conector IventIA–SAE: Guarda la clave SAE en el objeto de IventIA y lo marca Sincronizado
- Sigue — IventIA (sistema): Avisa al Contador los errores de sincronización pendientes

**Criterios de aceptación**
- Desde «IventIA › Bandeja de integración» puede realizar «Corrige el dato en el catálogo de IventIA o en la tabla de equivalencias SAT».
- Tiene 24 h para atenderlo; si vence, se avisa y se escala.
- Queda registro de quién lo hizo y cuándo.

**Necesita:** nada previo · **Habilita:** el cierre del proceso

## Roles y privilegios

| Rol | Privilegios |
|---|---|
| IventIA (sistema) | ver, recibir avisos |
| Conector IventIA–SAE | ver, autorizar |
| Aspel SAE / PAC (sistema) | ver |
| Contador | ver, ejecutar, recibir avisos |


---

# Facturar · Pago primero (PUE) automática

**Para qué:** Que el expositor reciba su CFDI timbrado en el portal minutos después de pedirlo, sin que Contabilidad capture nada.
**Hoy (AS IS):** HU-SA-08: el Contador abre la bandeja, valida RFC, genera el CFDI en SAE con los datos de la prefactura, timbra y adjunta a mano el XML y el PDF.
**Con la solución (TO BE):** La solicitud se valida sola, el conector crea el documento en SAE con las partidas de la orden y el pago, SAE timbra, y el XML/PDF regresan a IventIA y al portal. El Contador sólo ve excepciones.

**Etapas:** Solicitar → Validar → Registrar en SAE → Timbrar → Entregar  
**Duración estimada:** 6 día(s) hábil(es), termina el 2027-01-18

## Mapa de historias

| # | Historia | Rol | Etapa | Necesita | Habilita |
|---|---|---|---|---|---|
| HU-01 | Pide la factura de su solicitud pagada y elige el cliente de facturación | Expositor | Solicitar | — | HU-02 |
| HU-02 | ¿Los datos fiscales son válidos? | IventIA (sistema) | Validar | HU-01 | HU-04 |
| HU-03 | Corrige sus datos fiscales (la solicitud queda bloqueada) | Expositor | Validar | — | HU-04 |
| HU-04 | ¿Timbró sin error? | Conector IventIA–SAE | Timbrar | HU-02, HU-03 | HU-06 |
| HU-05 | Atiende el rechazo del PAC en la bandeja de excepciones y reintenta | Contador | Timbrar | — | HU-06 |
| HU-06 | Descarga el XML y el PDF desde el portal | Expositor | Entregar | HU-04, HU-05 | — |

## HU-01 · Pide la factura de su solicitud pagada y elige el cliente de facturación

**Como** Expositor, **quiero** pedir la factura de su solicitud pagada y elige el cliente de facturación **para** Que el expositor reciba su CFDI timbrado en el portal minutos después de pedirlo, sin que Contabilidad capture nada..

*Etapa:* Solicitar · *Tipo:* Captura

**Flujo**
- Hace — Expositor: Pide la factura de su solicitud pagada y elige el cliente de facturación _(Portal del expositor › Mis solicitudes)_
- Sigue — IventIA (sistema): Crea la solicitud de factura con la foto de datos fiscales y la prefactura
- Sigue — IventIA (sistema): Valida RFC, razón social, régimen y C.P. contra la constancia de situación fiscal
- Sigue — IventIA (sistema): le llega «¿Los datos fiscales son válidos?»

**Criterios de aceptación**
- Desde «Portal del expositor › Mis solicitudes» puede capturar «Pide la factura de su solicitud pagada y elige el cliente de facturación».
- Queda registro de quién lo hizo y cuándo.

**Necesita:** nada previo · **Habilita:** HU-02

## HU-02 · ¿Los datos fiscales son válidos?

**Como** IventIA (sistema), **quiero** decidir ¿Los datos fiscales son válidos? **para** Que el expositor reciba su CFDI timbrado en el portal minutos después de pedirlo, sin que Contabilidad capture nada..

*Etapa:* Validar · *Tipo:* Decisión

**Flujo**
- Recibe — IventIA (sistema): Valida RFC, razón social, régimen y C.P. contra la constancia de situación fiscal
- Hace — IventIA (sistema): ¿Los datos fiscales son válidos?
- Sigue — Conector IventIA–SAE: Asegura cliente, evento y recursos en SAE (catálogos espejo)
- Sigue — Conector IventIA–SAE: Crea la factura en SAE con las partidas de la orden, el evento y la serie de la organización
- Sigue — Aspel SAE / PAC (sistema): Genera el cargo en cuentas por cobrar y aplica el pago registrado en IventIA
- Sigue — Aspel SAE / PAC (sistema): Timbra el CFDI 4.0 (PUE, forma de pago del cobro) con el PAC
- Sigue — Conector IventIA–SAE: Si autoriza: le llega «¿Timbró sin error?»
- Sigue — Expositor: Si rechaza: regresa a «Corrige sus datos fiscales (la solicitud queda bloqueada)» _(Portal del expositor › Mis solicitudes)_

**Criterios de aceptación**
- Desde su bandeja puede decidir «¿Los datos fiscales son válidos?».
- Si autoriza continúa a «Asegura cliente, evento y recursos en SAE (catálogos espejo)»; si rechaza regresa a «Corrige sus datos fiscales (la solicitud queda bloqueada)» con el motivo.
- Queda registro de quién lo hizo y cuándo.

**Necesita:** HU-01 · **Habilita:** HU-04

## HU-03 · Corrige sus datos fiscales (la solicitud queda bloqueada)

**Como** Expositor, **quiero** corregir sus datos fiscales (la solicitud queda bloqueada) **para** Que el expositor reciba su CFDI timbrado en el portal minutos después de pedirlo, sin que Contabilidad capture nada..

*Etapa:* Validar · *Tipo:* Tarea · *Duración:* 1 día(s)

**Flujo**
- Hace — Expositor: Corrige sus datos fiscales (la solicitud queda bloqueada) _(Portal del expositor › Mis solicitudes)_
- Hace — Expositor: Al corregir vuelve al paso 3. _(Portal del expositor › Mis solicitudes)_
- Sigue — Conector IventIA–SAE: Asegura cliente, evento y recursos en SAE (catálogos espejo)
- Sigue — Conector IventIA–SAE: Crea la factura en SAE con las partidas de la orden, el evento y la serie de la organización
- Sigue — Aspel SAE / PAC (sistema): Genera el cargo en cuentas por cobrar y aplica el pago registrado en IventIA
- Sigue — Aspel SAE / PAC (sistema): Timbra el CFDI 4.0 (PUE, forma de pago del cobro) con el PAC
- Sigue — Conector IventIA–SAE: le llega «¿Timbró sin error?»

**Criterios de aceptación**
- Desde «Portal del expositor › Mis solicitudes» puede realizar «Corrige sus datos fiscales (la solicitud queda bloqueada)».
- Queda registro de quién lo hizo y cuándo.

**Necesita:** nada previo · **Habilita:** HU-04

## HU-04 · ¿Timbró sin error?

**Como** Conector IventIA–SAE, **quiero** decidir ¿Timbró sin error? **para** Que el expositor reciba su CFDI timbrado en el portal minutos después de pedirlo, sin que Contabilidad capture nada..

*Etapa:* Timbrar · *Tipo:* Decisión

**Flujo**
- Recibe — Aspel SAE / PAC (sistema): Timbra el CFDI 4.0 (PUE, forma de pago del cobro) con el PAC
- Hace — Conector IventIA–SAE: ¿Timbró sin error?
- Sigue — Conector IventIA–SAE: Sube XML y PDF a IventIA; valida sello SAT y que el UUID no esté duplicado
- Sigue — IventIA (sistema): Marca la solicitud Facturada y la orden facturada
- Sigue — IventIA (sistema): Avisa al expositor (correo y portal) y al coordinador
- Sigue — Expositor: Si autoriza: le llega «Descarga el XML y el PDF desde el portal» _(Portal del expositor › Mis solicitudes)_
- Sigue — Contador: Si rechaza: regresa a «Atiende el rechazo del PAC en la bandeja de excepciones y reintenta» _(IventIA › Contabilidad)_

**Criterios de aceptación**
- Desde su bandeja puede decidir «¿Timbró sin error?».
- Si autoriza continúa a «Sube XML y PDF a IventIA; valida sello SAT y que el UUID no esté duplicado»; si rechaza regresa a «Atiende el rechazo del PAC en la bandeja de excepciones y reintenta» con el motivo.
- Queda registro de quién lo hizo y cuándo.

**Necesita:** HU-02, HU-03 · **Habilita:** HU-06

## HU-05 · Atiende el rechazo del PAC en la bandeja de excepciones y reintenta

**Como** Contador, **quiero** atender el rechazo del PAC en la bandeja de excepciones y reintenta **para** Que el expositor reciba su CFDI timbrado en el portal minutos después de pedirlo, sin que Contabilidad capture nada..

*Etapa:* Timbrar · *Tipo:* Tarea · *Atención:* 4 h

**Flujo**
- Hace — Contador: Atiende el rechazo del PAC en la bandeja de excepciones y reintenta _(IventIA › Contabilidad)_
- Hace — Contador: Al reintentar vuelve al paso 9. _(IventIA › Contabilidad)_
- Sigue — Conector IventIA–SAE: Sube XML y PDF a IventIA; valida sello SAT y que el UUID no esté duplicado
- Sigue — IventIA (sistema): Marca la solicitud Facturada y la orden facturada
- Sigue — IventIA (sistema): Avisa al expositor (correo y portal) y al coordinador
- Sigue — Expositor: le llega «Descarga el XML y el PDF desde el portal» _(Portal del expositor › Mis solicitudes)_

**Criterios de aceptación**
- Desde «IventIA › Contabilidad» puede realizar «Atiende el rechazo del PAC en la bandeja de excepciones y reintenta».
- Tiene 4 h para atenderlo; si vence, se avisa y se escala.
- Queda registro de quién lo hizo y cuándo.

**Necesita:** nada previo · **Habilita:** HU-06

## HU-06 · Descarga el XML y el PDF desde el portal

**Como** Expositor, **quiero** descargar el XML y el PDF desde el portal **para** Que el expositor reciba su CFDI timbrado en el portal minutos después de pedirlo, sin que Contabilidad capture nada..

*Etapa:* Entregar · *Tipo:* Entregable

**Flujo**
- Recibe — IventIA (sistema): Avisa al expositor (correo y portal) y al coordinador
- Hace — Expositor: Descarga el XML y el PDF desde el portal · deja «CFDI 4.0 (XML y PDF)» _(Portal del expositor › Mis solicitudes)_

**Criterios de aceptación**
- Desde «Portal del expositor › Mis solicitudes» puede entregar «Descarga el XML y el PDF desde el portal» y deja «CFDI 4.0 (XML y PDF)».
- Queda registro de quién lo hizo y cuándo.

**Necesita:** HU-04, HU-05 · **Habilita:** el cierre del proceso

## Roles y privilegios

| Rol | Privilegios |
|---|---|
| Expositor | ver, capturar, ejecutar, recibir avisos |
| IventIA (sistema) | ver, autorizar, recibir avisos |
| Conector IventIA–SAE | ver, autorizar |
| Aspel SAE / PAC (sistema) | ver |
| Contador | ver, ejecutar, ver reportes |
| Coordinador SA | recibir avisos, ver |


---

# Facturar · Antes del pago (PPD) y complemento de pago

**Para qué:** Facturar a los clientes autorizados antes de que paguen y cerrar el ciclo fiscal con el complemento de pago cuando el dinero llega.
**Hoy (AS IS):** La factura previa se autoriza por correo; el complemento de pago se emite a mano y a veces no se emite.
**Con la solución (TO BE):** El coordinador autoriza en IventIA (queda auditado), SAE emite la factura PPD con su cargo en cuentas por cobrar y, al registrarse el pago en IventIA, SAE emite y timbra el complemento de pago (REP).

**Etapas:** Solicitar → Autorizar → Facturar → Cobrar → Complementar  
**Duración estimada:** 8 día(s) hábil(es), termina el 2027-01-20

## Mapa de historias

| # | Historia | Rol | Etapa | Necesita | Habilita |
|---|---|---|---|---|---|
| HU-01 | Pide factura antes de pagar (cliente habilitado en el evento) | Expositor | Solicitar | — | HU-02 |
| HU-02 | Autoriza la factura previa al pago | Coordinador SA | Autorizar | HU-01 | HU-03 |
| HU-03 | Paga en línea, por transferencia o en piso | Expositor | Cobrar | HU-02 | HU-04 |
| HU-04 | Registra o concilia el pago en IventIA | Coordinador SA | Cobrar | HU-03 | — |

## HU-01 · Pide factura antes de pagar (cliente habilitado en el evento)

**Como** Expositor, **quiero** pedir factura antes de pagar (cliente habilitado en el evento) **para** Facturar a los clientes autorizados antes de que paguen y cerrar el ciclo fiscal con el complemento de pago cuando el dinero llega..

*Etapa:* Solicitar · *Tipo:* Captura

**Flujo**
- Hace — Expositor: Pide factura antes de pagar (cliente habilitado en el evento) _(Portal del expositor › Mis solicitudes)_
- Sigue — Coordinador SA: le llega «Autoriza la factura previa al pago» _(IventIA › Mi espacio)_

**Criterios de aceptación**
- Desde «Portal del expositor › Mis solicitudes» puede capturar «Pide factura antes de pagar (cliente habilitado en el evento)».
- Queda registro de quién lo hizo y cuándo.

**Necesita:** nada previo · **Habilita:** HU-02

## HU-02 · Autoriza la factura previa al pago

**Como** Coordinador SA, **quiero** autorizar la factura previa al pago **para** Facturar a los clientes autorizados antes de que paguen y cerrar el ciclo fiscal con el complemento de pago cuando el dinero llega..

*Etapa:* Autorizar · *Tipo:* Autorización · *Atención:* 24 h

**Flujo**
- Recibe — Expositor: Termina «Pide factura antes de pagar (cliente habilitado en el evento)» y se lo pasa _(Portal del expositor › Mis solicitudes)_
- Hace — Coordinador SA: Autoriza la factura previa al pago _(IventIA › Mi espacio)_
- Hace — Coordinador SA: Si rechaza termina y se avisa al expositor. La autorización queda auditada. _(IventIA › Mi espacio)_
- Sigue — Conector IventIA–SAE: Crea la factura PPD (forma de pago 99) en SAE con su cargo en cuentas por cobrar
- Sigue — Aspel SAE / PAC (sistema): Timbra el CFDI y lo regresa a IventIA
- Sigue — IventIA (sistema): Publica XML y PDF en el portal y avisa al expositor
- Sigue — Expositor: Si autoriza: le llega «Paga en línea, por transferencia o en piso»
- Sigue — Coordinador SA: Si rechaza: el proceso termina con el motivo

**Criterios de aceptación**
- Desde «IventIA › Mi espacio» puede autorizar «Autoriza la factura previa al pago».
- Tiene 24 h para atenderlo; si vence, se avisa y se escala.
- Si autoriza continúa; si rechaza el proceso termina rechazado con el motivo.
- Queda registro de quién lo hizo y cuándo.

**Necesita:** HU-01 · **Habilita:** HU-03

## HU-03 · Paga en línea, por transferencia o en piso

**Como** Expositor, **quiero** pagar en línea, por transferencia o en piso **para** Facturar a los clientes autorizados antes de que paguen y cerrar el ciclo fiscal con el complemento de pago cuando el dinero llega..

*Etapa:* Cobrar · *Tipo:* Tarea · *Duración:* 5 día(s)

**Flujo**
- Recibe — IventIA (sistema): Publica XML y PDF en el portal y avisa al expositor
- Hace — Expositor: Paga en línea, por transferencia o en piso
- Sigue — Coordinador SA: le llega «Registra o concilia el pago en IventIA»

**Criterios de aceptación**
- Desde su bandeja puede realizar «Paga en línea, por transferencia o en piso».
- Queda registro de quién lo hizo y cuándo.

**Necesita:** HU-02 · **Habilita:** HU-04

## HU-04 · Registra o concilia el pago en IventIA

**Como** Coordinador SA, **quiero** registrar o concilia el pago en IventIA **para** Facturar a los clientes autorizados antes de que paguen y cerrar el ciclo fiscal con el complemento de pago cuando el dinero llega..

*Etapa:* Cobrar · *Tipo:* Captura · *Atención:* 24 h

**Flujo**
- Recibe — Expositor: Termina «Paga en línea, por transferencia o en piso» y se lo pasa
- Hace — Coordinador SA: Registra o concilia el pago en IventIA
- Sigue — Conector IventIA–SAE: Registra el abono en cuentas por cobrar de SAE ligado a la factura
- Sigue — Aspel SAE / PAC (sistema): Timbra el complemento de pago (REP 2.0)
- Sigue — IventIA (sistema): Adjunta el REP a la solicitud y avisa al expositor

**Criterios de aceptación**
- Desde su bandeja puede capturar «Registra o concilia el pago en IventIA».
- Tiene 24 h para atenderlo; si vence, se avisa y se escala.
- Queda registro de quién lo hizo y cuándo.

**Necesita:** HU-03 · **Habilita:** el cierre del proceso

## Roles y privilegios

| Rol | Privilegios |
|---|---|
| Expositor | ver, capturar, recibir avisos, ejecutar |
| Coordinador SA | ver, autorizar, capturar, recibir avisos |
| IventIA (sistema) | ver, recibir avisos |
| Conector IventIA–SAE | ver |
| Aspel SAE / PAC (sistema) | ver |


---

# Anticipos · Stand y servicios

**Para qué:** Que el anticipo del expositor se facture y se aplique correctamente a la factura final, con el saldo igual en IventIA y en SAE.
**Hoy (AS IS):** El anticipo se cobra en IventIA pero en SAE se factura aparte y se aplica a mano; los saldos no cuadran.
**Con la solución (TO BE):** Cada anticipo genera su CFDI de anticipo; la factura final relaciona el anticipo (tipo 07) y SAE salda la cuenta por cobrar con el egreso por aplicación del anticipo.

**Etapas:** Cobrar anticipo → Facturar anticipo → Facturar total → Aplicar anticipo  
**Duración estimada:** 3 día(s) hábil(es), termina el 2027-01-13

## Mapa de historias

| # | Historia | Rol | Etapa | Necesita | Habilita |
|---|---|---|---|---|---|
| HU-01 | Registra el anticipo del expositor en la orden | Coordinador SA | Cobrar anticipo | — | HU-02 |
| HU-02 | Cierra la orden con el total del evento | Coordinador SA | Facturar total | HU-01 | HU-03 |
| HU-03 | Revisa que el saldo de la orden y el de SAE coincidan | Contador | Aplicar anticipo | HU-02 | — |

## HU-01 · Registra el anticipo del expositor en la orden

**Como** Coordinador SA, **quiero** registrar el anticipo del expositor en la orden **para** Que el anticipo del expositor se facture y se aplique correctamente a la factura final, con el saldo igual en IventIA y en SAE..

*Etapa:* Cobrar anticipo · *Tipo:* Captura

**Flujo**
- Hace — Coordinador SA: Registra el anticipo del expositor en la orden _(IventIA › Solicitudes)_
- Sigue — Conector IventIA–SAE: Registra el anticipo en cuentas por cobrar de SAE y genera el CFDI de anticipo (serie FxANT, clave 84111506)
- Sigue — Aspel SAE / PAC (sistema): Timbra el CFDI de anticipo y lo devuelve a IventIA
- Sigue — Coordinador SA: le llega «Cierra la orden con el total del evento»

**Criterios de aceptación**
- Desde «IventIA › Solicitudes» puede capturar «Registra el anticipo del expositor en la orden».
- Queda registro de quién lo hizo y cuándo.

**Necesita:** nada previo · **Habilita:** HU-02

## HU-02 · Cierra la orden con el total del evento

**Como** Coordinador SA, **quiero** cerrar la orden con el total del evento **para** Que el anticipo del expositor se facture y se aplique correctamente a la factura final, con el saldo igual en IventIA y en SAE..

*Etapa:* Facturar total · *Tipo:* Tarea · *Duración:* 1 día(s)

**Flujo**
- Recibe — Aspel SAE / PAC (sistema): Timbra el CFDI de anticipo y lo devuelve a IventIA
- Hace — Coordinador SA: Cierra la orden con el total del evento
- Sigue — Conector IventIA–SAE: Crea la factura por el total relacionando el anticipo (CFDI relacionado 07)
- Sigue — Aspel SAE / PAC (sistema): Emite el egreso por aplicación del anticipo (serie NCxANT, relación 07) y salda la cuenta por cobrar
- Sigue — IventIA (sistema): Muestra al expositor su estado de cuenta con el anticipo aplicado
- Sigue — Contador: le llega «Revisa que el saldo de la orden y el de SAE coincidan»

**Criterios de aceptación**
- Desde su bandeja puede realizar «Cierra la orden con el total del evento».
- Queda registro de quién lo hizo y cuándo.

**Necesita:** HU-01 · **Habilita:** HU-03

## HU-03 · Revisa que el saldo de la orden y el de SAE coincidan

**Como** Contador, **quiero** revisar que el saldo de la orden y el de SAE coincidan **para** Que el anticipo del expositor se facture y se aplique correctamente a la factura final, con el saldo igual en IventIA y en SAE..

*Etapa:* Aplicar anticipo · *Tipo:* Revisión · *Atención:* 48 h

**Flujo**
- Recibe — IventIA (sistema): Muestra al expositor su estado de cuenta con el anticipo aplicado
- Hace — Contador: Revisa que el saldo de la orden y el de SAE coincidan

**Criterios de aceptación**
- Desde su bandeja puede revisar «Revisa que el saldo de la orden y el de SAE coincidan».
- Tiene 48 h para atenderlo; si vence, se avisa y se escala.
- Queda registro de quién lo hizo y cuándo.

**Necesita:** HU-02 · **Habilita:** el cierre del proceso

## Roles y privilegios

| Rol | Privilegios |
|---|---|
| Coordinador SA | ver, capturar, ejecutar |
| Conector IventIA–SAE | ver |
| Aspel SAE / PAC (sistema) | ver |
| IventIA (sistema) | ver, recibir avisos |
| Contador | ver, revisar |
| Expositor | recibir avisos |


---

# Ajustes · Refacturación, nota de crédito y reembolso

**Para qué:** Atender cancelaciones, cambios de datos y reembolsos con el CFDI correcto y ligado a la factura original.
**Hoy (AS IS):** Se pide por correo con carta; el Contador cancela y emite en SAE, y la nota de crédito no queda ligada a la solicitud en IventIA.
**Con la solución (TO BE):** El expositor lo pide en el portal con su carta, se autoriza en IventIA y el conector ejecuta en SAE la sustitución (motivo 01, relación 04) o la nota de crédito (relación 01 bonificación, 03 devolución) y actualiza cuentas por cobrar.

**Etapas:** Solicitar → Autorizar → Ejecutar en SAE → Cerrar  
**Duración estimada:** 5 día(s) hábil(es), termina el 2027-01-15

## Mapa de historias

| # | Historia | Rol | Etapa | Necesita | Habilita |
|---|---|---|---|---|---|
| HU-01 | Pide cancelación, cambio de datos o reembolso y adjunta su carta | Expositor | Solicitar | — | HU-02 |
| HU-02 | Revisa la carta, el motivo y el plazo (5 días antes del montaje) | Coordinador SA | Autorizar | HU-01 | HU-03 |
| HU-03 | Autoriza el ajuste; la nota de crédito no excede lo pagado | Contador | Autorizar | HU-02 | HU-04 |
| HU-04 | Programa el reembolso (10 días hábiles) y adjunta el comprobante | Contador | Cerrar | HU-03 | — |

## HU-01 · Pide cancelación, cambio de datos o reembolso y adjunta su carta

**Como** Expositor, **quiero** pedir cancelación, cambio de datos o reembolso y adjunta su carta **para** Atender cancelaciones, cambios de datos y reembolsos con el CFDI correcto y ligado a la factura original..

*Etapa:* Solicitar · *Tipo:* Captura

**Flujo**
- Hace — Expositor: Pide cancelación, cambio de datos o reembolso y adjunta su carta _(Portal del expositor › Mis solicitudes)_
- Sigue — Coordinador SA: le llega «Revisa la carta, el motivo y el plazo (5 días antes del montaje)»

**Criterios de aceptación**
- Desde «Portal del expositor › Mis solicitudes» puede capturar «Pide cancelación, cambio de datos o reembolso y adjunta su carta».
- Queda registro de quién lo hizo y cuándo.

**Necesita:** nada previo · **Habilita:** HU-02

## HU-02 · Revisa la carta, el motivo y el plazo (5 días antes del montaje)

**Como** Coordinador SA, **quiero** revisar la carta, el motivo y el plazo (5 días antes del montaje) **para** Atender cancelaciones, cambios de datos y reembolsos con el CFDI correcto y ligado a la factura original..

*Etapa:* Autorizar · *Tipo:* Revisión · *Atención:* 24 h

**Flujo**
- Recibe — Expositor: Termina «Pide cancelación, cambio de datos o reembolso y adjunta su carta» y se lo pasa _(Portal del expositor › Mis solicitudes)_
- Hace — Coordinador SA: Revisa la carta, el motivo y el plazo (5 días antes del montaje)
- Sigue — Contador: le llega «Autoriza el ajuste; la nota de crédito no excede lo pagado»

**Criterios de aceptación**
- Desde su bandeja puede revisar «Revisa la carta, el motivo y el plazo (5 días antes del montaje)».
- Tiene 24 h para atenderlo; si vence, se avisa y se escala.
- Queda registro de quién lo hizo y cuándo.

**Necesita:** HU-01 · **Habilita:** HU-03

## HU-03 · Autoriza el ajuste; la nota de crédito no excede lo pagado

**Como** Contador, **quiero** autorizar el ajuste; la nota de crédito no excede lo pagado **para** Atender cancelaciones, cambios de datos y reembolsos con el CFDI correcto y ligado a la factura original..

*Etapa:* Autorizar · *Tipo:* Autorización · *Atención:* 48 h

**Flujo**
- Recibe — Coordinador SA: Termina «Revisa la carta, el motivo y el plazo (5 días antes del montaje)» y se lo pasa
- Hace — Contador: Autoriza el ajuste; la nota de crédito no excede lo pagado
- Sigue — Conector IventIA–SAE: Refacturación: cancela con motivo 01 y emite el CFDI sustituto (relación 04)
- Sigue — Conector IventIA–SAE: Nota de crédito: genera en SAE la devolución (relación 03) o la bonificación (relación 01) ligada a la factura
- Sigue — Aspel SAE / PAC (sistema): Timbra y actualiza cuentas por cobrar
- Sigue — Contador: Si autoriza: le llega «Programa el reembolso (10 días hábiles) y adjunta el comprobante»
- Sigue — Contador: Si rechaza: el proceso termina con el motivo

**Criterios de aceptación**
- Desde su bandeja puede autorizar «Autoriza el ajuste; la nota de crédito no excede lo pagado».
- Tiene 48 h para atenderlo; si vence, se avisa y se escala.
- Si autoriza continúa; si rechaza el proceso termina rechazado con el motivo.
- Queda registro de quién lo hizo y cuándo.

**Necesita:** HU-02 · **Habilita:** HU-04

## HU-04 · Programa el reembolso (10 días hábiles) y adjunta el comprobante

**Como** Contador, **quiero** programar el reembolso (10 días hábiles) y adjunta el comprobante **para** Atender cancelaciones, cambios de datos y reembolsos con el CFDI correcto y ligado a la factura original..

*Etapa:* Cerrar · *Tipo:* Entregable · *Duración:* 2 día(s)

**Flujo**
- Recibe — Aspel SAE / PAC (sistema): Timbra y actualiza cuentas por cobrar
- Hace — Contador: Programa el reembolso (10 días hábiles) y adjunta el comprobante · deja «Comprobante de reembolso»
- Sigue — IventIA (sistema): Liga el ajuste a la solicitud original y avisa al expositor y al coordinador

**Criterios de aceptación**
- Desde su bandeja puede entregar «Programa el reembolso (10 días hábiles) y adjunta el comprobante» y deja «Comprobante de reembolso».
- Queda registro de quién lo hizo y cuándo.

**Necesita:** HU-03 · **Habilita:** el cierre del proceso

## Roles y privilegios

| Rol | Privilegios |
|---|---|
| Expositor | ver, capturar, recibir avisos |
| Coordinador SA | ver, revisar, recibir avisos |
| Contador | ver, autorizar, ejecutar |
| Conector IventIA–SAE | ver |
| Aspel SAE / PAC (sistema) | ver |
| IventIA (sistema) | ver, recibir avisos |


---

# Cierre contable · Conciliación IventIA–SAE–COI

**Para qué:** Que cada día IventIA, SAE y la contabilidad (COI) digan lo mismo: facturado, cobrado, anticipos y saldos por evento.
**Hoy (AS IS):** La conciliación es mensual y en Excel; las diferencias se descubren al cierre.
**Con la solución (TO BE):** Cada noche el conector compara IventIA contra SAE, la IA propone la causa de cada diferencia, el Contador la resuelve y SAE envía las pólizas a COI.

**Etapas:** Conciliar → Contabilizar → Reportar  
**Duración estimada:** 2 día(s) hábil(es), termina el 2027-01-12

## Mapa de historias

| # | Historia | Rol | Etapa | Necesita | Habilita |
|---|---|---|---|---|---|
| HU-01 | Resuelve las diferencias del día | Contador | Conciliar | — | HU-02 |
| HU-02 | Revisa y autoriza las pólizas del periodo | Gerente de Contabilidad | Contabilizar | HU-01 | — |

## HU-01 · Resuelve las diferencias del día

**Como** Contador, **quiero** resolver las diferencias del día **para** Que cada día IventIA, SAE y la contabilidad (COI) digan lo mismo: facturado, cobrado, anticipos y saldos por evento..

*Etapa:* Conciliar · *Tipo:* Tarea · *Atención:* 24 h

**Flujo**
- Recibe — IventIA (sistema): Explica cada diferencia y propone la causa
- Hace — Contador: Resuelve las diferencias del día _(IventIA › Contabilidad)_
- Sigue — Aspel SAE / PAC (sistema): Genera las pólizas de ventas, cobranza y anticipos en COI (interfaz SAE–COI por rango de documentos)
- Sigue — Gerente de Contabilidad: le llega «Revisa y autoriza las pólizas del periodo»

**Criterios de aceptación**
- Desde «IventIA › Contabilidad» puede realizar «Resuelve las diferencias del día».
- Tiene 24 h para atenderlo; si vence, se avisa y se escala.
- Queda registro de quién lo hizo y cuándo.

**Necesita:** nada previo · **Habilita:** HU-02

## HU-02 · Revisa y autoriza las pólizas del periodo

**Como** Gerente de Contabilidad, **quiero** revisar y autoriza las pólizas del periodo **para** Que cada día IventIA, SAE y la contabilidad (COI) digan lo mismo: facturado, cobrado, anticipos y saldos por evento..

*Etapa:* Contabilizar · *Tipo:* Autorización · *Atención:* 72 h

**Flujo**
- Recibe — Aspel SAE / PAC (sistema): Genera las pólizas de ventas, cobranza y anticipos en COI (interfaz SAE–COI por rango de documentos)
- Hace — Gerente de Contabilidad: Revisa y autoriza las pólizas del periodo
- Sigue — IventIA (sistema): Publica el tablero de facturación por evento: facturado, cobrado, anticipos y pendientes
- Sigue — IventIA (sistema): Avisa el cierre del día a Contabilidad y Finanzas
- Sigue — Contador: Si rechaza: regresa a «Resuelve las diferencias del día» _(IventIA › Contabilidad)_

**Criterios de aceptación**
- Desde su bandeja puede autorizar «Revisa y autoriza las pólizas del periodo».
- Tiene 72 h para atenderlo; si vence, se avisa y se escala.
- Si autoriza continúa; si rechaza regresa a «Resuelve las diferencias del día» con el motivo.
- Queda registro de quién lo hizo y cuándo.

**Necesita:** HU-01 · **Habilita:** el cierre del proceso

## Roles y privilegios

| Rol | Privilegios |
|---|---|
| Conector IventIA–SAE | ver |
| IventIA (sistema) | ver, recibir avisos |
| Contador | ver, ejecutar, recibir avisos |
| Aspel SAE / PAC (sistema) | ver |
| Gerente de Contabilidad | ver, autorizar, recibir avisos, ver reportes |
