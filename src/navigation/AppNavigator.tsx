import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";

import CustomDrawerContent from "../components/CustomDrawerContent";
import CustomTabBar from "../components/CustomTabBar";
import BookingDetailsScreen from "../screens/BookingDetailsScreen";
import BookingScreen from "../screens/BookingScreen";
import CategoryDetailScreen from "../screens/CategoryDetailScreen";
import CheckoutScreen from "../screens/CheckoutScreen";
import CompleteProfileScreen from "../screens/CompleteProfileScreen";
import HomeScreen from "../screens/HomeScreen";
import LoginScreen from "../screens/LoginScreen";
import MyBookingsScreen from "../screens/MyBookingsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import ResetPasswordScreen from "../screens/ResetPasswordScreen";
import ScheduleScreen from "../screens/ScheduleScreen";
import ServiceDetailScreen from "../screens/ServiceDetailScreen";
import CategoryServicesScreen from "../screens/CategoryServicesScreen";
import LocationAccessScreen from "../screens/LocationAccessScreen";
import ComingSoonScreen from "../screens/ComingSoonScreen";
import LocationSearchScreen from "../screens/LocationSearchScreen";

import { useAuthGuard } from "../hooks/useAuthGuard";
import { Service } from "../types/service";

/* ================= TYPES ================= */

export type SelectedService = {
  id: string;
  title: string;
  duration: string;
  price: string;
  service_type?: string;
  description?: string | null;
  image_url?: string | null;
  image?: string;
  original_price?: string | null;
  discount_percent?: number | null;
  discount_label?: string | null;
  tax_percent?: number | null;
  quantity?: number;
  main_category_id?: string | null;
  is_addon?: boolean;
};

export type RootStackParamList = {
  LocationAccess: undefined;
  ComingSoon: undefined;
  Login: undefined;
  HomeDrawer: {
    screen?: string;
    params?: any;
  };
  ServiceDetail: {
    service?: Service;
    serviceId?: string;
  };
  Booking: {
    services: SelectedService[];
  };
  Schedule: {
    services: SelectedService[];
  };
  Checkout: {
    services: SelectedService[];
    total: number;
    bookingDateText: string;
  };
  ResetPassword: {
    access_token?: string;
    refresh_token?: string;
  };
  BookingDetails: {
    booking: any;
  };
  CategoryDetail: {
    category: string;
    label: string;
  };
  CategoryServices: {
    mainCategoryName: string;
    mainCategoryId: string;
    subCategories: any[];
  };
  CompleteProfile: undefined;
};

export type HomeStackParamList = {
  HomeMain: undefined;
  ServiceDetail: { service?: Service; serviceId?: string };
  Booking: { services: SelectedService[] };
  Schedule: { services: SelectedService[] };
  Checkout: { services: SelectedService[]; total: number; bookingDateText: string };
  CategoryDetail: { category: string; label: string };
  CategoryServices: { mainCategoryName: string; mainCategoryId: string; subCategories: any[] };
  LocationSearch: undefined;
};

export type BookingsStackParamList = {
  BookingsMain: undefined;
  BookingDetails: { booking: any };
};

export type AuthenticatedStackParamList = {
  MainTabs: undefined;
  ResetPassword: { access_token?: string; refresh_token?: string };
  CompleteProfile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const AuthenticatedStack = createNativeStackNavigator<AuthenticatedStackParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const BookingsStack = createNativeStackNavigator<BookingsStackParamList>();
const Drawer = createDrawerNavigator();
const Tab = createBottomTabNavigator();

function HomeTabStack() {
  const { theme } = useTheme();
  return (
    <HomeStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: theme.background }
      }}
    >
      <HomeStack.Screen name="HomeMain" component={HomeScreen as any} />
      <HomeStack.Screen name="ServiceDetail" component={ServiceDetailScreen as any} />
      <HomeStack.Screen name="Booking" component={BookingScreen as any} />
      <HomeStack.Screen name="Schedule" component={ScheduleScreen as any} />
      <HomeStack.Screen name="Checkout" component={CheckoutScreen as any} />
      <HomeStack.Screen name="CategoryDetail" component={CategoryDetailScreen as any} />
      <HomeStack.Screen name="CategoryServices" component={CategoryServicesScreen as any} />
      <HomeStack.Screen name="LocationSearch" component={LocationSearchScreen as any} />
    </HomeStack.Navigator>
  );
}

function BookingsTabStack() {
  const { theme } = useTheme();
  return (
    <BookingsStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: theme.background }
      }}
    >
      <BookingsStack.Screen name="BookingsMain" component={MyBookingsScreen as any} />
      <BookingsStack.Screen name="BookingDetails" component={BookingDetailsScreen as any} />
    </BookingsStack.Navigator>
  );
}

function MainTabs() {
  const { theme } = useTheme();
  const { checkAuth } = useAuthGuard();

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.background },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeTabStack}
        options={{ tabBarLabel: "Home" }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate("HomeTab", { screen: "HomeMain" });
          },
        })}
      />
      <Tab.Screen
        name="MyBookingsTab"
        component={BookingsTabStack}
        options={{ tabBarLabel: "Bookings" }}
        listeners={({ navigation }) => ({
          tabPress: async (e) => {
            e.preventDefault();
            const isAuth = await checkAuth("view your bookings");
            if (isAuth) {
              navigation.navigate("MyBookingsTab");
            }
          },
        })}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen as any}
        options={{ tabBarLabel: "Profile" }}
        listeners={({ navigation }) => ({
          tabPress: async (e) => {
            e.preventDefault();
            const isAuth = await checkAuth("view your profile");
            if (isAuth) {
              navigation.navigate("ProfileTab");
            }
          },
        })}
      />
    </Tab.Navigator>
  );
}

function AuthenticatedScreens() {
  const { theme } = useTheme();
  return (
    <AuthenticatedStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: theme.background }
      }}
    >
      <AuthenticatedStack.Screen name="MainTabs" component={MainTabs} />
    </AuthenticatedStack.Navigator>
  );
}

function HomeDrawer() {
  return (
    <Drawer.Navigator
      id="root-drawer"
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: "front",
        drawerPosition: "right",
        drawerStyle: { width: "85%" },
      }}
    >
      <Drawer.Screen name="AuthenticatedScreens" component={AuthenticatedScreens} />
    </Drawer.Navigator>
  );
}

type AppNavigatorProps = {
  initialRouteName: keyof RootStackParamList;
};

/* ================= MAIN NAVIGATOR ================= */

export default function AppNavigator({ initialRouteName }: AppNavigatorProps) {
  const { theme } = useTheme();
  return (
    <Stack.Navigator
      initialRouteName={initialRouteName as any}
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: theme.background }
      }}
    >
      <Stack.Screen name="LocationAccess" component={LocationAccessScreen} />
      <Stack.Screen name="ComingSoon" component={ComingSoonScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen as any} />
      <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen as any} />
      <Stack.Screen name="HomeDrawer" component={HomeDrawer} />
    </Stack.Navigator>
  );
}