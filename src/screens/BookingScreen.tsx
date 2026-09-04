import { RouteProp, useNavigation } from "@react-navigation/native";
import { useEffect } from "react";
import { View } from "react-native";
import { RootStackParamList } from "../navigation/AppNavigator";

type Props = {
  route: RouteProp<RootStackParamList, "Booking">;
};

export default function BookingScreen({ route }: Props) {
  const navigation = useNavigation<any>();

  useEffect(() => {
    navigation.replace("Schedule", {
      services: route.params.services,
    });
  }, []);

  return <View />;
}
