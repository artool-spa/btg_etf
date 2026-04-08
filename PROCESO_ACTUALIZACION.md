# Proceso de Actualización de Datos — BTG ETF Dashboard

## Antes de empezar — Preguntas obligatorias
Al iniciar una actualización, confirmar siempre:

1. **¿Cuál es el período que estamos reportando?** (ej: "23 Mar – 12 Abr")
2. **¿Cuál es la ruta del spreadsheet actualizado?**
3. **¿Hay nuevas plataformas o audiencias que no estaban antes?**
4. **¿El presupuesto mensual sigue siendo $3.800.000?**
5. **¿La fecha de inicio de campaña sigue siendo 24 Mar?** (afecta el pacing)

---

## PASO 1 — Extraer datos del spreadsheet

Ejecutar este script para extraer todos los valores necesarios:

```bash
python3 << 'EOF'
import pandas as pd

ARCHIVO = 'RUTA_AL_SPREADSHEET.xlsx'

xl = pd.ExcelFile(ARCHIVO)
df_perf  = pd.read_excel(ARCHIVO, sheet_name='PERFORMANCE',  header=None)
df_aud   = pd.read_excel(ARCHIVO, sheet_name='AUDIENCIAS',   header=None)
df_otros = pd.read_excel(ARCHIVO, sheet_name='OTROS MEDIOS', header=None)

# Imprimir filas de datos para revisión
print("=== PERFORMANCE ===")
for i in range(5, 20):
    try:
        row = df_perf.iloc[i]
        vals = [str(v) for v in row if str(v) != 'nan']
        if vals: print(f"Fila {i}: {' | '.join(vals)}")
    except: pass

print("\n=== AUDIENCIAS ===")
for i in range(0, 30):
    try:
        row = df_aud.iloc[i]
        vals = [str(v) for v in row if str(v) != 'nan']
        if vals: print(f"Fila {i}: {' | '.join(vals)}")
    except: pass

print("\n=== OTROS MEDIOS ===")
for i in range(0, 30):
    try:
        row = df_otros.iloc[i]
        vals = [str(v) for v in row if str(v) != 'nan']
        if vals: print(f"Fila {i}: {' | '.join(vals)}")
    except: pass
EOF
```

### Estructura del spreadsheet (columnas PERFORMANCE)
**Fila 7 = S1, Fila 8 = S2. Sumar para acumulado.**

| # Col | Meta | LinkedIn | Google Search | Totales |
|---|---|---|---|---|
| Inversión | col 3 | col 13 | col 26 | col 32 |
| Alcance | col 4 | col 14 | — | col 33 |
| Impresiones | col 5 | col 15 | col 27 | col 34 |
| Clics | col 6 | col 16 | col 28 | col 35 |
| Video Views | col 7 | col 17 | — | — |
| **Registros** | — | **col 18** | — | — |
| CPM | col 8 | col 19 | — | col 36 |
| CPC | col 9 | col 20 | col 29 | col 37 |
| CPV | col 10 | col 21 | — | — |
| Sesiones | col 11 | col 24 | col 31 | — |
| Duración | col 12 | col 25 | col 32 | — |

---

## PASO 2 — Sync GA4

```bash
# Ajustar end= a la fecha de cierre del período (ayer)
curl -s "https://syncga4manual-wcp2ajv2ya-uc.a.run.app?start=2026-03-23&end=YYYY-MM-DD"
```

Verificar que devuelva `"status": "ok"` y anotar:
- `total_users`
- `total_sessions`
- `total_avg_duration`
- `period` (el label que quedará en Firestore)

---

## PASO 3 — Actualizar index.html

### 3.1 CAMPAIGN_DOC_ID (si cambió el end date)
```javascript
// Buscar en index.html:
const CAMPAIGN_DOC_ID = '2026-03-23_YYYY-MM-DD';
```

### 3.2 Período en textos
Buscar y reemplazar la fecha anterior por la nueva en todos los textos:
- Título sección Paid Social
- Título sección Otros Medios
- Título sección Audiencias
- Título GA4
- Lectura ejecutiva
- KPI metas labels (`kpi-week-label`)
- Tooltip proyección

### 3.3 RESUMEN — KPI cards
| Campo | ID/selector | Valor |
|---|---|---|
| Impresiones | `data-counter` en card impresiones | total paid social imp |
| Impresiones % | `data-pct` | (imp / 5.000.000) * 100 |
| Alcance | `data-counter` en card alcance | total paid social alc |
| Alcance % | `data-pct` | (alc / 1.800.000) * 100 |
| Sesiones | `data-counter` en card sesiones | total sesiones |
| Sesiones % | `data-pct` | (ses / 11.000) * 100 |

### 3.4 RESUMEN — Budget card
| Campo | Valor |
|---|---|
| `card-big` | % ejecutado (inv_total / 3.800.000 * 100) |
| `card-sub` | "$X.XXX.XXX de $3.800.000" |
| Bar width | mismo % |
| Footer | "Día X de 30 · Pacing esperado Y%" (automático) |

### 3.5 RESUMEN — Projection card
| Métrica | Proyección = real / meta * (30/días_transcurridos) |
|---|---|
| Impresiones | imp / 5.000.000 * (30/días) |
| Sesiones | ses / 11.000 * (30/días) |

### 3.6 RESUMEN — Clics + CPM duo cards
- Clics: total clics paid social
- CPC: inversión total / clics
- CPV: inversión total / video views
- CPM: $XXX (promedio ponderado)

### 3.7 PAID SOCIAL — Total row
Período · Inversión · Alcance · Impresiones · Clics · Video Views · CPM · CPC

### 3.8 PAID SOCIAL — Platform cards
| Campo | Meta | LinkedIn | Google Search |
|---|---|---|---|
| invest-badge | inv S1+S2 | inv S1+S2 | inv S1+S2 |
| Alcance | alc S1+S2 | alc S1+S2 | — |
| Impresiones | imp S1+S2 | imp S1+S2 | imp S1+S2 |
| Clics | cli S1+S2 | cli S1+S2 | cli S1+S2 |
| Video Views | views S1+S2 | views S1+S2 | — |
| CPM | $XXX | $XXX | — |
| CPC | $XXX | $XXX | $XXX |
| CPV | inv/views | inv/views | — |
| Registros (LinkedIn) | — | sum registros | — |
| Duración (Google) | — | — | MM:SS |
| CTR (Google) | — | — | cli/imp % |

### 3.9 OTROS MEDIOS — Total row
Inversión · Alcance · Impresiones · Clics

### 3.10 OTROS MEDIOS — Platform cards
| Campo | DF | Emol | Bio Bio |
|---|---|---|---|
| invest-badge | $XXX | $XXX | $XXX |
| Alcance | XXX | XXX | XXX |
| Impresiones | XXX | XXX | XXX |
| Clics | XXX | XXX | XXX |
| Sesiones | XXX | XXX | XXX |
| CPM | inv/imp*1000 | inv/imp*1000 | inv/imp*1000 |
| CPC | inv/clics | inv/clics | inv/clics |

### 3.11 AUDIENCIAS — Cards (6 audiencias)
Por cada audiencia: alcance · impresiones · CPM · frecuencia (imp/alc) · sesiones

### 3.12 LECTURA EJECUTIVA — JS dinámico
```javascript
// Buscar en index.html renderGA4():
const imp   = XXXXXXX;   // total impresiones paid social
const alc   = XXXXXXX;   // total alcance paid social
const clics = XXXX;      // total clics paid social
const views = XXXXXX;    // total video views paid social
```

### 3.13 FUNNEL — Pasos 1 y 2
- Paso 1: Impresiones y Alcance totales (paid social)
- Paso 2: Clics y Video Views

### 3.14 CHARTS
- Donut: `data: [meta_inv, linkedin_inv, search_inv]` + labels con montos
- Bar alcance: `data: [meta_alc, linkedin_alc, 0]`
- Bar impresiones: `data: [meta_imp, linkedin_imp, search_imp]`

---

## PASO 4 — Verificación rápida

Checklist antes del commit:
- [ ] Período correcto en todos los títulos de sección
- [ ] Budget % coincide con (inversión / 3.800.000)
- [ ] Impresiones KPI = suma Meta + LinkedIn + Google (paid social only)
- [ ] Alcance KPI = suma Meta + LinkedIn (Google Search no tiene alcance)
- [ ] CPM promedio = inversión_total_paid / impresiones_total * 1000
- [ ] LinkedIn registros = suma S1+S2 columna Registros
- [ ] CAMPAIGN_DOC_ID actualizado en index.html
- [ ] Textos sin menciones a "semana", "S1", "S2"
- [ ] Charts con datos actualizados

---

## PASO 5 — Deploy

```bash
cd /Users/ap/Documents/btg_etf

git add index.html
git commit -m "Actualización período [PERÍODO] — datos [FECHA_SPREADSHEET]"
git push origin main
```

### Si se actualizó la Cloud Function:
```bash
cd /Users/ap/Documents/btg_etf/firebase
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
/opt/homebrew/opt/node@20/bin/npx firebase deploy --only functions --project btg---etf
```

---

## Notas de mantenimiento

- **Cada nueva semana**: el sync semanal automático corre los lunes 09:00. No interfiere con el dashboard porque éste lee por `CAMPAIGN_DOC_ID` fijo.
- **Al cerrar campaña**: actualizar `CAMPAIGN_START` en el JS del pacing y `CAMPAIGN_DOC_ID`.
- **Si hay nueva audiencia**: agregar card en `grid-6` (máx 3 por fila), actualizar lectura ejecutiva de audiencias.
- **Si hay nuevo medio**: agregar card en grid de Otros Medios, sumar al total row.
- **Google Search en GA4**: aún no aparece en resultados del landing. Verificar URL de destino de la campaña en Google Ads.
