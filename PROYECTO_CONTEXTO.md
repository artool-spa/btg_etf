# BTG ETF Genérico — Contexto del Proyecto

## Qué es esto
Dashboard semanal de campaña digital para BTG Pactual Chile, producto **ETF Genérico**.
URL del dashboard: https://parodiscl.github.io/btg_etf/ (o dominio configurado en Firebase Hosting)
Repo: https://github.com/parodiscl/btg_etf
Archivo principal: `/Users/ap/Documents/btg_etf/index.html`

---

## Campaña
- **Inicio**: 24 de marzo 2026
- **Duración**: 30 días
- **Presupuesto mensual**: $3.800.000 CLP
- **Landing**: https://www.btgpactual.cl/que-hacemos/asset-management/etf
- **Gestión**: Artool (Paid Social) + Havas (Otros Medios)

### Metas mensuales
| Métrica | Meta |
|---|---|
| Impresiones | 5.000.000 |
| Alcance | 1.800.000 |
| Sesiones landing | 11.000 |

---

## Canales activos

### PAID SOCIAL — Artool
| Plataforma | Descripción |
|---|---|
| Meta Platform | Awareness masivo, CPM bajo |
| LinkedIn | Audiencia profesional financiera, registros directos |
| Google Search | Captura intención de búsqueda ETF |

### OTROS MEDIOS — Havas
| Medio | Descripción |
|---|---|
| DF Digital | Diario Financiero, audiencia financiera |
| Emol Digital | Mayor duración de sesión |
| Bio Bio | Mayor volumen de clics |

> Próximos a incorporar en spreadsheet: **money_talks/newsletter** y **sidebar_ML/banner** (ya aparecen en GA4)

---

## Audiencias (Meta + LinkedIn)
| Audiencia | Plataforma |
|---|---|
| Banca Privada | LinkedIn |
| Altos Cargos | LinkedIn |
| Asset Management | LinkedIn |
| Inversionistas Retail | Meta |
| Interés ETF | Meta |
| Alto Patrimonio | Meta (incorporada en S2) |

---

## Arquitectura técnica

### Frontend
- `index.html` — archivo único, sin build process
- Chart.js para gráficos
- Firebase Auth (Google + email/password)
- Firestore para datos GA4 dinámicos

### Backend (Firebase Cloud Functions — `firebase/functions/index.js`)
| Función | Tipo | Descripción |
|---|---|---|
| `syncGA4Weekly` | Scheduled (lunes 09:00 Santiago) | Sync automático semana anterior |
| `syncGA4Manual` | HTTP GET | Sync manual por período |
| `checkGA4Events` | HTTP GET | Diagnóstico de eventos en landing |

### GA4
- **Property ID**: almacenada como Firebase Secret `GA4_PROPERTY_ID`
- **Filtro de landing**: `/que-hacemos/asset-management/etf`
- **Filtro de campaña**: `sessionCampaignName` CONTAINS `btg_etf` OR exacto `[BTG] (BTG Corp) - Search Tráfico Fondo ETF Genérico`
- **Documento Firestore activo**: `campaigns/etf-generico/weeks/2026-03-23_2026-04-06`
- **ID en index.html**: `const CAMPAIGN_DOC_ID = '2026-03-23_2026-04-06'`

### UTMs requeridas para que GA4 capture tráfico
| Plataforma | utm_campaign debe contener |
|---|---|
| Meta | `btg_etf` |
| LinkedIn | `btg_etf` |
| Google Ads | nombre exacto de campaña (automático) |

---

## Datos estáticos vs dinámicos

### Dinámico (GA4 → Firestore → Dashboard)
- Usuarios y sesiones en landing (período)
- Duración media de sesión
- Gráfico por fuente/medio
- Desglose por campaña

### Estático (hardcodeado en index.html, se actualiza con cada cierre)
- Todos los KPIs de Paid Social (Meta, LinkedIn, Google Search)
- Todos los datos de Otros Medios (DF, Emol, Bio Bio)
- Audiencias (alcance, impresiones, CPM, frecuencia, sesiones)
- Presupuesto ejecutado
- Proyección de metas
- Lectura ejecutiva
- Funnel pasos 1 y 2

---

## Notas importantes
- Google Search NO aparece en resultados GA4 del landing — posible discrepancia de URL de destino. Pendiente verificar.
- Botón "Ver Fondo" en la landing → trackeable por GTM (pendiente activar)
- Enhanced Measurement GA4 está activo: captura `scroll`, `outbound_click`
- Hay 6 clics a `mercadosenlinea.cl` desde la landing (botón de inversión)
- El sync semanal automático (lunes) crea documentos separados — el dashboard siempre lee el documento por `CAMPAIGN_DOC_ID` fijo
- Los acumulados en Firestore solo suman desde `2026-03-23` (CAMPAIGN_START_DATE en index.js)
