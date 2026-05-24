import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../auth/AuthContext";
import { LoginScreen } from "../screens/LoginScreen";
import { RegisterScreen } from "../screens/RegisterScreen";
import { PaymentScreen } from "../screens/PaymentScreen";
import { MainScreen } from "../screens/MainScreen";
import { AddCollegeScreen } from "../screens/AddCollegeScreen";
import { EditCollegeScreen } from "../screens/EditCollegeScreen";
import { EditAdminScreen } from "../screens/EditAdminScreen";
import { AddBusesScreen } from "../screens/AddBusesScreen";
import { AddDriversScreen } from "../screens/AddDriversScreen";
import { AddStudentsScreen } from "../screens/AddStudentsScreen";
import { AssignDriversToBusScreen } from "../screens/AssignDriversToBusScreen";
import { AssignStudentsToBusScreen } from "../screens/AssignStudentsToBusScreen";
import { SelectDriverForBusScreen } from "../screens/SelectDriverForBusScreen";
import { SelectStudentsForBusScreen } from "../screens/SelectStudentsForBusScreen";
import { BusDetailScreen } from "../screens/BusDetailScreen";
import { SetBusRouteScreen } from "../screens/SetBusRouteScreen";
import { ViewBusesScreen } from "../screens/ViewBusesScreen";
import { ViewDriversScreen } from "../screens/ViewDriversScreen";
import { ViewStudentsScreen } from "../screens/ViewStudentsScreen";
import { EditDriverScreen } from "../screens/EditDriverScreen";
import { EditStudentScreen } from "../screens/EditStudentScreen";
import { DriverDashboardScreen } from "../screens/DriverDashboardScreen";
import { StudentDashboardScreen } from "../screens/StudentDashboardScreen";
import { CollegeProvider } from "../college/CollegeContext";
import type {
  AppStackParamList,
  AuthStackParamList,
  DriverStackParamList,
  StudentStackParamList,
} from "./types";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();
const DriverStack = createNativeStackNavigator<DriverStackParamList>();
const StudentStack = createNativeStackNavigator<StudentStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="Payment" component={PaymentScreen} />
    </AuthStack.Navigator>
  );
}

function AppNavigator() {
  return (
    <AppStack.Navigator screenOptions={{ headerShown: false }}>
      <AppStack.Screen name="Main" component={MainScreen} />
      <AppStack.Screen name="AddCollege" component={AddCollegeScreen} />
      <AppStack.Screen name="EditCollege" component={EditCollegeScreen} />
      <AppStack.Screen name="EditAdmin" component={EditAdminScreen} />
      <AppStack.Screen name="AddBuses" component={AddBusesScreen} />
      <AppStack.Screen name="AddDrivers" component={AddDriversScreen} />
      <AppStack.Screen name="AddStudents" component={AddStudentsScreen} />
      <AppStack.Screen
        name="AssignDriversToBus"
        component={AssignDriversToBusScreen}
      />
      <AppStack.Screen
        name="AssignStudentsToBus"
        component={AssignStudentsToBusScreen}
      />
      <AppStack.Screen
        name="SelectDriverForBus"
        component={SelectDriverForBusScreen}
      />
      <AppStack.Screen
        name="SelectStudentsForBus"
        component={SelectStudentsForBusScreen}
      />
      <AppStack.Screen name="BusDetail" component={BusDetailScreen} />
      <AppStack.Screen name="SetBusRoute" component={SetBusRouteScreen} />
      <AppStack.Screen name="ViewBuses" component={ViewBusesScreen} />
      <AppStack.Screen name="ViewDrivers" component={ViewDriversScreen} />
      <AppStack.Screen name="ViewStudents" component={ViewStudentsScreen} />
      <AppStack.Screen name="EditDriver" component={EditDriverScreen} />
      <AppStack.Screen name="EditStudent" component={EditStudentScreen} />
    </AppStack.Navigator>
  );
}

function DriverNavigator() {
  return (
    <DriverStack.Navigator screenOptions={{ headerShown: false }}>
      <DriverStack.Screen
        name="DriverDashboard"
        component={DriverDashboardScreen}
      />
    </DriverStack.Navigator>
  );
}

function StudentNavigator() {
  return (
    <StudentStack.Navigator screenOptions={{ headerShown: false }}>
      <StudentStack.Screen
        name="StudentDashboard"
        component={StudentDashboardScreen}
      />
    </StudentStack.Navigator>
  );
}

export function RootNavigator() {
  const { ready, token, session } = useAuth();

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!token || !session) {
    return (
      <NavigationContainer>
        <AuthNavigator />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      {session.role === "admin" ? (
        <CollegeProvider>
          <AppNavigator />
        </CollegeProvider>
      ) : session.role === "driver" ? (
        <DriverNavigator />
      ) : (
        <StudentNavigator />
      )}
    </NavigationContainer>
  );
}
