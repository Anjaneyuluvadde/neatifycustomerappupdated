export type ServiceType = "BATHROOM" | "KITCHEN" | "HOUSE" | string;

export interface MainCategory {
  id: string;
  name: string;
  icon_url: string | null;
  sort_order: number;
}

export interface Service {
  id: string;
  slug?: string;
  title: string;

  /**
   * Used for tab filtering and service identification
   */
  service_type: ServiceType;

  /**
   * Order in which this category should appear in tabs
   */
  category_order?: number;

  duration: string;
  price: string;

  /**
   * Main hero image
   */
  image: string;

  /**
   * Gallery images (Supabase text[])
   */
  gallery_images?: string[];

  /**
   * Second image or gallery alternative (workframes)
   */
  image2?: string | string[] | any;

  /**
   * Full description from Supabase column
   */
  description?: string;

  /**
   * Sort order for displaying services
   */
  sort_order?: number;

  /**
   * Original price before discount
   */
  original_price?: string | null;

  /**
   * Discount percentage (e.g., 20 for 20% off)
   */
  discount_percent?: number | null;

  /**
   * Custom offer text from '%' column (e.g., "5%", "Special Offer")
   * This is the text that will be displayed in the discount badge
   */
  /**
   * Custom offer text from '%' column (e.g., "5%", "Special Offer")
   * This is the text that will be displayed in the discount badge
   */
  discount_label?: string | null;

  /**
   * Description of what the service includes
   */
  work_includes?: string | null;

  /**
   * Description of what the service does NOT include
   */
  work_not_included?: string | null;

  /**
   * Tax percentage to apply (e.g., 5 for 5% tax)
   */
  tax_percent?: number | null;

  /**
   * Link to the main category (from main_categories table)
   */
  main_category_id?: string | null;

  /**
   * Icon for the category display in the bottom sheet
   */
  category_icon_url?: string | null;

  /**
   * Dynamic JSON column for How it works section
   */
  how_it_works?: any;
}
