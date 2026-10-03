"""
Generate synthetic test files for Amazon Settlement Flat File V2 parser testing.
All files respect the exact 24-column specification of GET_V2_SETTLEMENT_REPORT_DATA_FLAT_FILE_V2.
No real customer or financial data is included.
"""

import os
import random

os.makedirs("tests/fixtures", exist_ok=True)

HEADERS = [
    "settlement-id",
    "settlement-start-date",
    "settlement-end-date",
    "deposit-date",
    "total-amount",
    "currency",
    "transaction-type",
    "order-id",
    "merchant-order-id",
    "adjustment-id",
    "shipment-id",
    "marketplace-name",
    "amount-type",
    "amount-description",
    "amount",
    "fulfillment-id",
    "posted-date",
    "posted-date-time",
    "order-item-code",
    "merchant-order-item-id",
    "merchant-adjustment-item-id",
    "sku",
    "quantity-purchased",
    "promotion-id",
]

def format_row(row_dict):
    return "\t".join(str(row_dict.get(h, "")) for h in HEADERS)

# --- 1. Valid Realistic Sample (Comma Decimals, EUR, Amazon.es) ---
def generate_valid_sample(filename="tests/fixtures/sample_valid_es.txt", decimal_sep=",", num_orders=25):
    def fmt(val):
        s = f"{val:.2f}"
        return s.replace(".", decimal_sep)

    settlement_id = "18492049181"
    start_date = "2026-09-15T00:00:00+00:00"
    end_date = "2026-09-29T00:00:00+00:00"
    deposit_date = "2026-10-01T06:12:00+00:00"
    currency = "EUR"

    rows = []
    total_calculated = 0.0

    # Orders
    for i in range(1, num_orders + 1):
        order_id = f"405-8192301-{1000000 + i}"
        item_price = round(random.uniform(15.0, 95.0), 2)
        shipping_price = round(random.choice([0.0, 3.99, 4.95]), 2)
        commission = round(-item_price * 0.15, 2)
        fba_fee = round(random.choice([-2.85, -3.45, -4.20, -5.10]), 2)
        
        # Principal
        rows.append({
            "settlement-id": settlement_id,
            "currency": currency,
            "transaction-type": "Order",
            "order-id": order_id,
            "marketplace-name": "Amazon.es",
            "amount-type": "ItemPrice",
            "amount-description": "Principal",
            "amount": fmt(item_price),
            "posted-date": "18/09/2026",
            "posted-date-time": "2026-09-18T10:15:20+00:00",
            "sku": f"PROD-ES-{i:03d}",
            "quantity-purchased": 1,
        })
        total_calculated += item_price

        # Shipping
        if shipping_price > 0:
            rows.append({
                "settlement-id": settlement_id,
                "currency": currency,
                "transaction-type": "Order",
                "order-id": order_id,
                "marketplace-name": "Amazon.es",
                "amount-type": "ItemPrice",
                "amount-description": "Shipping",
                "amount": fmt(shipping_price),
                "posted-date": "18/09/2026",
                "posted-date-time": "2026-09-18T10:15:20+00:00",
                "sku": f"PROD-ES-{i:03d}",
                "quantity-purchased": 1,
            })
            total_calculated += shipping_price

        # Commission
        rows.append({
            "settlement-id": settlement_id,
            "currency": currency,
            "transaction-type": "Order",
            "order-id": order_id,
            "marketplace-name": "Amazon.es",
            "amount-type": "ItemFees",
            "amount-description": "Commission",
            "amount": fmt(commission),
            "posted-date": "18/09/2026",
            "posted-date-time": "2026-09-18T10:15:20+00:00",
            "sku": f"PROD-ES-{i:03d}",
            "quantity-purchased": 1,
        })
        total_calculated += commission

        # FBA Fee
        rows.append({
            "settlement-id": settlement_id,
            "currency": currency,
            "transaction-type": "Order",
            "order-id": order_id,
            "marketplace-name": "Amazon.es",
            "amount-type": "ItemFees",
            "amount-description": "FBAPerUnitFulfillmentFee",
            "amount": fmt(fba_fee),
            "posted-date": "18/09/2026",
            "posted-date-time": "2026-09-18T10:15:20+00:00",
            "sku": f"PROD-ES-{i:03d}",
            "quantity-purchased": 1,
        })
        total_calculated += fba_fee

    # Promotional discount on 2 orders
    promo_amount = -10.00
    rows.append({
        "settlement-id": settlement_id,
        "currency": currency,
        "transaction-type": "Order",
        "order-id": f"405-8192301-1000001",
        "marketplace-name": "Amazon.es",
        "amount-type": "Promotion",
        "amount-description": "Principal",
        "amount": fmt(promo_amount),
        "posted-date": "20/09/2026",
        "posted-date-time": "2026-09-20T14:10:00+00:00",
        "sku": "PROD-ES-001",
        "quantity-purchased": 1,
        "promotion-id": "SPRING_DISCOUNT",
    })
    total_calculated += promo_amount

    # 1 Refund
    refund_amount = -35.00
    refund_comm = 5.25
    refund_fee = -1.05
    rows.append({
        "settlement-id": settlement_id,
        "currency": currency,
        "transaction-type": "Refund",
        "order-id": "405-8192301-1000005",
        "marketplace-name": "Amazon.es",
        "amount-type": "ItemPrice",
        "amount-description": "Principal",
        "amount": fmt(refund_amount),
        "posted-date": "25/09/2026",
        "posted-date-time": "2026-09-25T09:30:00+00:00",
        "sku": "PROD-ES-005",
        "quantity-purchased": 1,
    })
    rows.append({
        "settlement-id": settlement_id,
        "currency": currency,
        "transaction-type": "Refund",
        "order-id": "405-8192301-1000005",
        "marketplace-name": "Amazon.es",
        "amount-type": "ItemFees",
        "amount-description": "Commission",
        "amount": fmt(refund_comm),
        "posted-date": "25/09/2026",
        "posted-date-time": "2026-09-25T09:30:00+00:00",
        "sku": "PROD-ES-005",
        "quantity-purchased": 1,
    })
    rows.append({
        "settlement-id": settlement_id,
        "currency": currency,
        "transaction-type": "Refund",
        "order-id": "405-8192301-1000005",
        "marketplace-name": "Amazon.es",
        "amount-type": "ItemFees",
        "amount-description": "RefundCommission",
        "amount": fmt(refund_fee),
        "posted-date": "25/09/2026",
        "posted-date-time": "2026-09-25T09:30:00+00:00",
        "sku": "PROD-ES-005",
        "quantity-purchased": 1,
    })
    total_calculated += (refund_amount + refund_comm + refund_fee)

    # Monthly Subscription fee
    sub_fee = -39.00
    rows.append({
        "settlement-id": settlement_id,
        "currency": currency,
        "transaction-type": "ServiceFee",
        "marketplace-name": "Amazon.es",
        "amount-type": "ServiceFee",
        "amount-description": "Subscription",
        "amount": fmt(sub_fee),
        "posted-date": "20/09/2026",
        "posted-date-time": "2026-09-20T00:00:00+00:00",
    })
    total_calculated += sub_fee

    # Advertising Cost
    ad_cost = -84.50
    rows.append({
        "settlement-id": settlement_id,
        "currency": currency,
        "transaction-type": "ServiceFee",
        "marketplace-name": "Amazon.es",
        "amount-type": "ServiceFee",
        "amount-description": "Cost of Advertising",
        "amount": fmt(ad_cost),
        "posted-date": "28/09/2026",
        "posted-date-time": "2026-09-28T23:59:59+00:00",
    })
    total_calculated += ad_cost

    # FBA Storage fee
    storage_fee = -14.20
    rows.append({
        "settlement-id": settlement_id,
        "currency": currency,
        "transaction-type": "ServiceFee",
        "marketplace-name": "Amazon.es",
        "amount-type": "ServiceFee",
        "amount-description": "FBAStorageFee",
        "amount": fmt(storage_fee),
        "posted-date": "28/09/2026",
        "posted-date-time": "2026-09-28T00:00:00+00:00",
    })
    total_calculated += storage_fee

    # Reserves: Previous released (+200.00), Current held (-250.00)
    prev_reserve = 200.00
    curr_reserve = -250.00
    rows.append({
        "settlement-id": settlement_id,
        "currency": currency,
        "transaction-type": "other-transaction",
        "amount-type": "Reserve Amount",
        "amount-description": "Previous Reserve Amount",
        "amount": fmt(prev_reserve),
        "posted-date": "15/09/2026",
        "posted-date-time": "2026-09-15T00:00:00+00:00",
    })
    rows.append({
        "settlement-id": settlement_id,
        "currency": currency,
        "transaction-type": "other-transaction",
        "amount-type": "Reserve Amount",
        "amount-description": "Current Reserve Amount",
        "amount": fmt(curr_reserve),
        "posted-date": "29/09/2026",
        "posted-date-time": "2026-09-29T23:59:59+00:00",
    })
    total_calculated += (prev_reserve + curr_reserve)

    total_calculated = round(total_calculated, 2)

    # First data row: Summary Header
    summary_row = {
        "settlement-id": settlement_id,
        "settlement-start-date": start_date,
        "settlement-end-date": end_date,
        "deposit-date": deposit_date,
        "total-amount": fmt(total_calculated),
        "currency": currency,
    }

    with open(filename, "w", encoding="utf-8") as f:
        f.write("\t".join(HEADERS) + "\n")
        f.write(format_row(summary_row) + "\n")
        for r in rows:
            f.write(format_row(r) + "\n")

    print(f"Generated {filename}: {len(rows)+1} rows, total-amount: {fmt(total_calculated)} EUR")
    return total_calculated

# Generate all 10 test fixtures
generate_valid_sample("tests/fixtures/test1_valid_v2_comma.txt", decimal_sep=",", num_orders=30)
generate_valid_sample("tests/fixtures/test6_decimal_comma.txt", decimal_sep=",", num_orders=10)
generate_valid_sample("tests/fixtures/test7_decimal_dot.txt", decimal_sep=".", num_orders=10)

# Test 2: Empty File
with open("tests/fixtures/test2_empty.txt", "w", encoding="utf-8") as f:
    f.write("")

# Test 3: Malformed File (Random text)
with open("tests/fixtures/test3_malformed.txt", "w", encoding="utf-8") as f:
    f.write("Esto no es un archivo de liquidacion de Amazon\nLínea 2 de texto plano sin tabuladores ni cabeceras validas.")

# Test 4: CSV non-Amazon (Bank statement CSV)
with open("tests/fixtures/test4_non_amazon_bank.csv", "w", encoding="utf-8") as f:
    f.write("Fecha,Concepto,Importe,Saldo\n01/10/2026,Transferencia Amazon,4312.18,15420.50\n02/10/2026,Alquiler oficina,-850.00,14570.50\n")

# Test 5: Currency USD
def generate_usd_sample():
    with open("tests/fixtures/test5_currency_usd.txt", "w", encoding="utf-8") as f:
        f.write("\t".join(HEADERS) + "\n")
        f.write(format_row({
            "settlement-id": "99887766",
            "settlement-start-date": "2026-09-01T00:00:00Z",
            "settlement-end-date": "2026-09-15T00:00:00Z",
            "deposit-date": "2026-09-17T00:00:00Z",
            "total-amount": "1450.00",
            "currency": "USD"
        }) + "\n")
        f.write(format_row({
            "settlement-id": "99887766",
            "currency": "USD",
            "transaction-type": "Order",
            "order-id": "111-222-333",
            "amount-type": "ItemPrice",
            "amount-description": "Principal",
            "amount": "1450.00",
        }) + "\n")
generate_usd_sample()

# Test 8: Special Characters (Acentos, ñ, símbolos en SKU y Marketplace)
def generate_special_chars_sample():
    with open("tests/fixtures/test8_special_chars.txt", "w", encoding="utf-8") as f:
        f.write("\t".join(HEADERS) + "\n")
        f.write(format_row({
            "settlement-id": "77665544",
            "total-amount": "100.00",
            "currency": "EUR"
        }) + "\n")
        f.write(format_row({
            "settlement-id": "77665544",
            "currency": "EUR",
            "transaction-type": "Order",
            "order-id": "ES-ESP-9988-ÑÁÉÍÓÚ",
            "marketplace-name": "Amazon.es - España",
            "amount-type": "ItemPrice",
            "amount-description": "Principal",
            "amount": "100.00",
            "sku": "CAMISETA-NIÑO-AZUL-TALLA-PEQUEÑA",
        }) + "\n")
generate_special_chars_sample()

# Test 9: 15,000+ lines performance sample
def generate_large_sample():
    print("Generating 15,000+ lines performance fixture...")
    generate_valid_sample("tests/fixtures/test9_large_15k.txt", decimal_sep=",", num_orders=3800)
generate_large_sample()

# Test 10: Unexpected columns
def generate_unexpected_cols_sample():
    custom_headers = HEADERS + ["extra_unknown_col_1", "vendor_flag"]
    with open("tests/fixtures/test10_unexpected_cols.txt", "w", encoding="utf-8") as f:
        f.write("\t".join(custom_headers) + "\n")
        f.write(format_row({
            "settlement-id": "55443322",
            "total-amount": "50.00",
            "currency": "EUR"
        }) + "\textra_val_1\tTRUE\n")
        f.write(format_row({
            "settlement-id": "55443322",
            "currency": "EUR",
            "transaction-type": "Order",
            "order-id": "111-222-444",
            "amount-type": "ItemPrice",
            "amount-description": "Principal",
            "amount": "50.00",
        }) + "\textra_val_2\tFALSE\n")
generate_unexpected_cols_sample()

print("All 10 test fixtures created successfully!")
