import React, { createContext, useContext, useMemo, useState } from "react";
import { SelectedService } from "../navigation/AppNavigator";
import { Service } from "../types/service";

type BookingCartContextType = {
  cartItems: SelectedService[];
  addService: (service: Service | SelectedService) => void;
  removeService: (serviceId: string) => void;
  updateQuantity: (serviceId: string, delta: number) => void;
  clearCart: () => void;
  totalPrice: number;
  totalUnits: number;
  totalServices: number;
};

const BookingCartContext = createContext<BookingCartContextType | null>(null);

export function applyCartRules(prev: SelectedService[], service: Service | SelectedService): SelectedService[] {
  const isAddon = (service as any).is_addon;
  const incomingMainCategoryId = (service as any).main_category_id;
  const incomingServiceType = service.service_type;

  const currentMainService = prev.find(s => !s.is_addon && s.main_category_id);

  if (isAddon) {
    if (!currentMainService) return prev;
    if (incomingServiceType && currentMainService.service_type) {
      if (incomingServiceType.toUpperCase() !== currentMainService.service_type.toUpperCase()) {
        return prev;
      }
    }
    const existing = prev.find(s => s.id === service.id);
    if (existing) return prev;

    return [...prev, {
      ...service,
      quantity: 1,
      is_addon: true
    } as SelectedService];
  } else {
    const existing = prev.find((s) => s.id === service.id);
    if (existing) return prev;

    let filteredPrev = prev;

    if (currentMainService) {
      if (currentMainService.main_category_id !== incomingMainCategoryId) {
        filteredPrev = [];
      } else {
        filteredPrev = filteredPrev.filter(s => s.id !== currentMainService.id);
        filteredPrev = filteredPrev.filter(s => {
          if (s.is_addon && s.service_type && incomingServiceType) {
            return s.service_type.toUpperCase() === incomingServiceType.toUpperCase();
          }
          return false;
        });
      }
    }

    return [
      ...filteredPrev,
      {
        id: service.id,
        title: service.title,
        duration: service.duration,
        price: service.price,
        service_type: service.service_type,
        original_price: (service as any).original_price,
        discount_percent: (service as any).discount_percent,
        discount_label: (service as any).discount_label,
        tax_percent: (service as any).tax_percent,
        image: (service as any).image,
        main_category_id: incomingMainCategoryId,
        is_addon: false,
        quantity: 1,
      } as SelectedService,
    ];
  }
}

export function BookingCartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<SelectedService[]>([]);


  const addService = (service: Service | SelectedService) => {
    setCartItems((prev) => applyCartRules(prev, service));
  };

  const removeService = (serviceId: string) => {
    setCartItems((prev) => prev.filter((s) => s.id !== serviceId));
  };

  const updateQuantity = (serviceId: string, delta: number) => {
    setCartItems((prev) => {
      return prev.map((s) => {
        if (s.id === serviceId) {
          const newQuantity = (s.quantity || 1) + delta;
          return { ...s, quantity: newQuantity };
        }
        return s;
      }).filter(s => (s.quantity || 1) > 0);
    });
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const totalPrice = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      const cleanPrice = String(item.price).replace(/[^\d.]/g, '');
      const priceVal = parseFloat(cleanPrice) || 0;
      return sum + (priceVal * (item.quantity || 1));
    }, 0);
  }, [cartItems]);

  const totalUnits = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
  }, [cartItems]);

  const totalServices = cartItems.length;

  const value = useMemo(
    () => ({
      cartItems,
      addService,
      removeService,
      updateQuantity,
      clearCart,
      totalPrice,
      totalUnits,
      totalServices,
    }),
    [cartItems, totalPrice, totalUnits, totalServices]
  );

  return (
    <BookingCartContext.Provider value={value}>
      {children}
    </BookingCartContext.Provider>
  );
}

export function useBookingCart() {
  const ctx = useContext(BookingCartContext);
  if (!ctx) {
    throw new Error("useBookingCart must be used inside BookingCartProvider");
  }
  return ctx;
}
