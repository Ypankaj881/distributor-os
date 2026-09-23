"use client";

import Button from "@/components/ui/Button";
import QtyStepper from "@/components/ui/QtyStepper";
import { useCart } from "./CartProvider";

// "Add" button that turns into a − qty + stepper once the product is in the cart.
// The first tap adds the product's minimum order quantity.
export default function AddToCartControl({ product, size = "md", className }) {
  const { quantities, setQuantity } = useCart();
  const qty = quantities[product.id] ?? 0;
  const moq = product.minOrderQty ?? 1;

  if (qty === 0) {
    if (!product.orderable) {
      return <Button variant="secondary" size={size} disabled className={className}>Out of stock</Button>;
    }
    return (
      <Button size={size} className={className} onClick={() => setQuantity(product.id, moq)}>
        Add{moq > 1 ? ` ${moq}` : ""}
      </Button>
    );
  }

  return (
    <QtyStepper
      className={className}
      size={size}
      value={qty}
      min={moq}
      label={`Quantity of ${product.name}`}
      onChange={(q) => setQuantity(product.id, q)}
    />
  );
}
