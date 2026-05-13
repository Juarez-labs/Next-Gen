import React, { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useAuth } from "./src/contexts/AuthContext";
import { LocaleProvider } from "./src/contexts/LocaleContext";
import { GameProvider, useGame } from "./src/contexts/GameContext";
import { AuthScreen } from "./src/screens/AuthScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { HostLobbyScreen } from "./src/screens/HostLobbyScreen";
import { JoinScreen } from "./src/screens/JoinScreen";
import { GameScreen } from "./src/screens/GameScreen";
import { CustomizeScreen } from "./src/screens/CustomizeScreen";

type Route = "home" | "host" | "join" | "customize";

function Router() {
  const { game } = useGame();
  const [route, setRoute] = useState<Route>("home");

  if (game && (game.status === "playing" || game.status === "finished")) {
    return <GameScreen onLeave={() => setRoute("home")} />;
  }
  if (game && game.status === "lobby") {
    return <HostLobbyScreen onCancel={() => setRoute("home")} />;
  }

  switch (route) {
    case "host":
      return <HostLobbyScreen onCancel={() => setRoute("home")} />;
    case "join":
      return <JoinScreen onCancel={() => setRoute("home")} />;
    case "customize":
      return <CustomizeScreen onBack={() => setRoute("home")} />;
    case "home":
    default:
      return (
        <HomeScreen
          onHost={() => setRoute("host")}
          onJoin={() => setRoute("join")}
          onCustomize={() => setRoute("customize")}
        />
      );
  }
}

function Gate() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!user) return <AuthScreen />;
  return (
    <GameProvider>
      <Router />
    </GameProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LocaleProvider>
        <AuthProvider>
          <Gate />
          <StatusBar style="auto" />
        </AuthProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}
