import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { supabase } from "../lib/supabase";
import { Service } from "../types/service";

export type CartItem = {
  id: string; // ✅ cart row id (Supabase row id)
  service_id: string;
  title: string;
  duration: string;
  price: string;
  image?: string;
};

type CartContextType = {
  cartItems: CartItem[];
  loadingCart: boolean;

  fetchCart: () => Promise<void>;

  // ✅ returns true if added successfully
  addToCart: (service: Service) => Promise<boolean>;

  // ✅ delete by service_id
  removeFromCart: (service_id: string) => Promise<void>;

  clearCart: () => Promise<void>;

  isInCart: (service_id: string) => boolean;
};

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loadingCart, setLoadingCart] = useState(true);

  // ======================================================
  // FETCH CART
  // ======================================================
  const fetchCart = async () => {
    setLoadingCart(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setCartItems([]);
        return;
      }

      const { data, error } = await supabase
        .from("cart_items")
        .select("id, service_id, title, duration, price, image")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setCartItems((data as any) || []);
    } catch (err: any) {
      console.log("fetchCart error:", err.message);
    } finally {
      setLoadingCart(false);
    }
  };

  // ======================================================
  // ADD TO CART (NO ALERT HERE ✅)
  // ======================================================
  const addToCart = async (service: Service) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Please login to add items to cart.");
      }

      const { error } = await supabase.from("cart_items").insert({
        user_id: user.id,
        service_id: service.id,
        title: service.title,
        duration: service.duration,
        price: service.price,
        image: service.image,
      });

      if (error) {
        // ✅ duplicate row unique constraint
        if (error.code === "23505") {
          throw new Error("Already in Cart");
        }
        throw error;
      }

      await fetchCart();
      return true;
    } catch (err: any) {
      throw err;
    }
  };

  // ======================================================
  // REMOVE FROM CART (BY service_id ✅)
  // ======================================================
  const removeFromCart = async (service_id: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { error } = await supabase
        .from("cart_items")
        .delete()
        .eq("user_id", user.id)
        .eq("service_id", service_id);

      if (error) throw error;

      await fetchCart();
    } catch (err: any) {
      throw err;
    }
  };

  // ======================================================
  // CLEAR CART
  // ======================================================
  const clearCart = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { error } = await supabase
        .from("cart_items")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;

      await fetchCart();
    } catch (err: any) {
      throw err;
    }
  };

  // ======================================================
  // CHECK IF IN CART
  // ======================================================
  const isInCart = (service_id: string) => {
    return cartItems.some((x) => x.service_id === service_id);
  };

  // ✅ Auto fetch cart after app opens
  useEffect(() => {
    fetchCart();
  }, []);

  const value = useMemo(
    () => ({
      cartItems,
      loadingCart,
      fetchCart,
      addToCart,
      removeFromCart,
      clearCart,
      isInCart,
    }),
    [cartItems, loadingCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
