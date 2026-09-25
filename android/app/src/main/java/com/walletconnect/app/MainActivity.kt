package com.walletconnect.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val Teal = Color(0xFF0F766E)
private val TealSoft = Color(0xFFE7F6F3)
private val Page = Color(0xFFF4F8F7)
private val Ink = Color(0xFF12201E)
private val Muted = Color(0xFF71807D)

class MainActivity : ComponentActivity() {
    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        setContent { WalletConnect() }
    }
}

@Composable
fun WalletConnect() {
    var tab by remember { mutableIntStateOf(0) }
    var balance by remember { mutableLongStateOf(0L) }

    MaterialTheme(colorScheme = lightColorScheme(primary = Teal, background = Page, surface = Color.White)) {
        Scaffold(
            containerColor = Page,
            bottomBar = {
                NavigationBar(containerColor = Color.White) {
                    listOf("Accueil" to "⌂", "Envoyer" to "↗", "Activité" to "◷", "Portefeuille" to "▣", "Profil" to "●")
                        .forEachIndexed { i, item ->
                            NavigationBarItem(
                                selected = tab == i,
                                onClick = { tab = i },
                                icon = { Text(item.second, fontSize = 18.sp) },
                                label = { Text(item.first, fontSize = 10.sp) }
                            )
                        }
                }
            }
        ) { pad ->
            when (tab) {
                0 -> Home(balance, pad, { tab = 1 }, { tab = 3 })
                1 -> Send(balance, pad) { amount -> balance -= (amount * 1.01).toLong(); tab = 2 }
                2 -> Activity(pad)
                3 -> Wallet(balance, pad) { balance += it }
                else -> Profile(pad)
            }
        }
    }
}

@Composable
fun Header() {
    Row(Modifier.fillMaxWidth().padding(bottom = 16.dp), Arrangement.SpaceBetween, Alignment.CenterVertically) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(42.dp).background(Brush.linearGradient(listOf(Color(0xFF14B8A6), Teal)), RoundedCornerShape(14.dp)), Alignment.Center) {
                Text("W", color = Color.White, fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold)
            }
            Spacer(Modifier.width(10.dp))
            Column {
                Text("Wallet Connect", fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold, fontSize = 19.sp)
                Text("Paiements simples, partout", color = Muted, fontSize = 11.sp)
            }
        }
        Surface(shape = CircleShape, color = Color.White) { Text("A", Modifier.padding(12.dp), color = Teal) }
    }
}

@Composable
fun Balance(balance: Long) {
    Card(colors = CardDefaults.cardColors(containerColor = Teal), shape = RoundedCornerShape(28.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(22.dp)) {
            Text("Solde disponible", color = Color.White.copy(.72f), fontSize = 12.sp)
            Text(String.format("%,d XAF", balance), color = Color.White, fontSize = 34.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold)
            Spacer(Modifier.height(15.dp))
            Surface(color = Color.White.copy(.10f), shape = RoundedCornerShape(20.dp)) {
                Text("XAF • Principal", color = Color.White, fontSize = 11.sp, modifier = Modifier.padding(9.dp))
            }
        }
    }
}

@Composable
fun Home(balance: Long, pad: PaddingValues, send: () -> Unit, wallet: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(pad).padding(16.dp)) {
        Header()
        Text("Bonjour 👋", fontSize = 25.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold)
        Text("Voici l'état de ton portefeuille", color = Muted, fontSize = 13.sp)
        Spacer(Modifier.height(16.dp))
        Balance(balance)
        Spacer(Modifier.height(16.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(9.dp), modifier = Modifier.fillMaxWidth()) {
            Quick("↗", "Envoyer", Modifier.weight(1f), send)
            Quick("＋", "Recharger", Modifier.weight(1f), wallet)
            Quick("↓", "Retirer", Modifier.weight(1f), wallet)
        }
        Spacer(Modifier.height(22.dp))
        Text("Activité récente", fontWeight = androidx.compose.ui.text.font.FontWeight.Bold, fontSize = 16.sp)
        Spacer(Modifier.height(10.dp))
        Empty("Aucune transaction pour le moment")
        Spacer(Modifier.height(18.dp))
        Text("Mon portefeuille", fontWeight = androidx.compose.ui.text.font.FontWeight.Bold, fontSize = 16.sp)
        Spacer(Modifier.height(10.dp))
        Stat("Devise", "Solde principal", "XAF")
        Stat("Frais d'envoi", "Configuration actuelle", "1%")
        Stat("Retrait", "Frais plateforme", "0 XAF")
    }
}

@Composable
fun Quick(icon: String, title: String, modifier: Modifier, action: () -> Unit) {
    OutlinedButton(onClick = action, modifier = modifier.height(92.dp), shape = RoundedCornerShape(18.dp)) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Surface(color = TealSoft, shape = RoundedCornerShape(12.dp)) { Text(icon, color = Teal, modifier = Modifier.padding(9.dp)) }
            Spacer(Modifier.height(6.dp)); Text(title, color = Ink, fontSize = 11.sp)
        }
    }
}

@Composable
fun Stat(title: String, sub: String, value: String) {
    Card(shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)) {
        Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) { Text(title, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold, fontSize = 13.sp); Text(sub, color = Muted, fontSize = 11.sp) }
            Text(value, color = Teal, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold, fontSize = 13.sp)
        }
    }
}

@Composable
fun Empty(text: String) {
    Card(shape = RoundedCornerShape(22.dp), modifier = Modifier.fillMaxWidth()) {
        Box(Modifier.fillMaxWidth().padding(30.dp), Alignment.Center) { Text(text, color = Muted, fontSize = 13.sp) }
    }
}

@Composable
fun Send(balance: Long, pad: PaddingValues, done: (Long) -> Unit) {
    var phone by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }
    val value = amount.toLongOrNull() ?: 0L
    val fee = (value * .01).toLong()
    Column(Modifier.fillMaxSize().padding(pad).padding(16.dp)) {
        Text("Envoyer de l'argent", fontSize = 25.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold)
        Text("Transfère rapidement à un autre utilisateur.", color = Muted, fontSize = 13.sp)
        Spacer(Modifier.height(18.dp))
        Card(shape = RoundedCornerShape(22.dp)) {
            Column(Modifier.padding(17.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(phone, { phone = it }, label = { Text("Téléphone ou identifiant") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                OutlinedTextField(amount, { amount = it.filter(Char::isDigit) }, label = { Text("Montant en XAF") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                Stat("Frais d'envoi", "1% du montant", fee.toString() + " XAF")
                Stat("Total débité", "Montant + frais", (value + fee).toString() + " XAF")
                Button(onClick = { if (phone.isNotBlank() && value > 0 && value + fee <= balance) done(value) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(15.dp)) {
                    Text("Continuer", fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
                }
                Text("Le transfert réel sera exécuté par le backend sécurisé.", color = Muted, fontSize = 11.sp)
            }
        }
    }
}

@Composable
fun Activity(pad: PaddingValues) {
    Column(Modifier.fillMaxSize().padding(pad).padding(16.dp)) {
        Text("Activité", fontSize = 25.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold)
        Text("Toutes tes opérations au même endroit.", color = Muted, fontSize = 13.sp)
        Spacer(Modifier.height(16.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            listOf("Tout", "Envoyés", "Reçus").forEach { Text(it, color = Teal, modifier = Modifier.background(TealSoft, RoundedCornerShape(30.dp)).padding(horizontal = 12.dp, vertical = 8.dp), fontSize = 11.sp) }
        }
        Spacer(Modifier.height(12.dp)); Empty("Aucune transaction pour le moment")
    }
}

@Composable
fun Wallet(balance: Long, pad: PaddingValues, topup: (Long) -> Unit) {
    var amount by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize().padding(pad).padding(16.dp)) {
        Text("Portefeuille", fontSize = 25.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold)
        Text("Gère ton argent et tes moyens de paiement.", color = Muted, fontSize = 13.sp)
        Spacer(Modifier.height(16.dp)); Balance(balance); Spacer(Modifier.height(14.dp))
        Card(shape = RoundedCornerShape(22.dp)) {
            Column(Modifier.padding(17.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Recharger", fontWeight = androidx.compose.ui.text.font.FontWeight.Bold, fontSize = 16.sp)
                OutlinedTextField(amount, { amount = it.filter(Char::isDigit) }, label = { Text("Montant en XAF") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                Text("MTN Mobile Money", color = Teal, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
                Button(onClick = { amount.toLongOrNull()?.takeIf { it > 0 }?.let(topup) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(15.dp)) { Text("Continuer avec MTN") }
            }
        }
        Spacer(Modifier.height(12.dp)); Empty("Retrait MTN disponible pour le premier test.")
    }
}

@Composable
fun Profile(pad: PaddingValues) {
    Column(Modifier.fillMaxSize().padding(pad).padding(16.dp)) {
        Text("Profil", fontSize = 25.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold)
        Text("Ton compte Wallet Connect.", color = Muted, fontSize = 13.sp)
        Spacer(Modifier.height(16.dp))
        Card(shape = RoundedCornerShape(22.dp)) {
            Column(Modifier.padding(17.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(color = Teal, shape = RoundedCornerShape(20.dp)) { Text("A", color = Color.White, modifier = Modifier.padding(20.dp), fontSize = 20.sp) }
                    Spacer(Modifier.width(12.dp)); Column { Text("Utilisateur", fontWeight = androidx.compose.ui.text.font.FontWeight.Bold, fontSize = 18.sp); Text("Compte personnel", color = Muted, fontSize = 12.sp) }
                }
                listOf("Informations personnelles", "Vérification du compte", "Moyens de paiement", "Aide & support", "Paramètres").forEach {
                    Row(Modifier.fillMaxWidth().padding(vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Surface(color = TealSoft, shape = RoundedCornerShape(12.dp)) { Text("•", color = Teal, modifier = Modifier.padding(10.dp)) }
                        Spacer(Modifier.width(10.dp)); Text(it, Modifier.weight(1f), fontSize = 13.sp); Text("›", color = Muted, fontSize = 20.sp)
                    }
                }
            }
        }
    }
}
