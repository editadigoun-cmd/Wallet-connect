package com.walletconnect.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.foundation.layout.fillMaxSize
import com.walletconnect.app.ui.screens.*

class MainActivity : ComponentActivity() {
    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        setContent { WalletConnectApp() }
    }
}

@Composable
fun WalletConnectApp() {
    var tab by remember { mutableIntStateOf(0) }
    var balance by remember { mutableLongStateOf(0L) }

    WalletConnectTheme {
        Scaffold(
            containerColor = Page,
            bottomBar = {
                NavigationBar(containerColor = androidx.compose.ui.graphics.Color.White) {
                    listOf("Accueil","Envoyer","Activité","Portefeuille","Profil").forEachIndexed { i, label ->
                        NavigationBarItem(
                            selected = tab == i,
                            onClick = { tab = i },
                            icon = { Text(label.take(1)) },
                            label = { Text(label) }
                        )
                    }
                }
            }
        ) { pad: PaddingValues ->
            when (tab) {
                0 -> HomeScreen(balance,pad,{tab=1},{tab=3})
                1 -> SendScreen(balance,pad) { amount -> balance -= (amount + (amount*.01).toLong()); tab=2 }
                2 -> ActivityScreen(pad)
                3 -> WalletScreen(balance,pad) { amount -> balance += amount }
                else -> ProfileScreen(pad)
            }
        }
    }
}
