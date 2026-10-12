from prometheus_client import Counter

ORDER_TRANSITIONS = Counter(
    "procurement_order_transitions_total",
    "Purchase order status changes",
    ["action"],
)

STOCK_SYNC = Counter(
    "procurement_stock_sync_total",
    "Stock updates sent to Lucky Mart, by result",
    ["result"],
)
