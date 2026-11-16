"""Referencia de mercado usada para el veredicto.

Foto del 16/11/2026. No se consulta en vivo: cuando la rueda se mueva,
se actualizan estos números.
"""

from decimal import Decimal

REFERENCE_DATE = "16/11/2026"
REFERENCE_SOURCE = "Pulso by Gallo, rueda BYMA del 16/11/2026"

# Promedio ponderado por volumen de cauciones en pesos.
MARKET_TNA = Decimal("20.83")
# Caución a 30 días, usada para el premio del tramo medio.
MEDIUM_TNA = Decimal("23")
# Plazo fijo a 30 días, promedio de 6 bancos.
PLAZO_FIJO_TNA = Decimal("20.5")
# Inflación de octubre 2026 (INDEC) y REM a 12 meses.
INFLATION_MONTH = Decimal("2.2")
INFLATION_YEAR_EXPECTED = Decimal("21.8")

# Bandas ya redondeadas: promedio ± 1,5 puntos, y los premios por plazo.
WEAK_BELOW = Decimal("19.3")
GOOD_FROM = Decimal("22.3")
HURDLE_8_TO_30 = Decimal("22.8")
HURDLE_OVER_30 = Decimal("23.8")

VERDICT_ORDER = {
    "Conviene": 0,
    "Aceptable": 1,
    "Poco premio": 2,
    "No conviene": 3,
}
