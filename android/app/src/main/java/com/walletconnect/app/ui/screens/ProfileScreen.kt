package com.walletconnect.app.ui.screens
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.walletconnect.app.Muted
@Composable fun ProfileScreen(pad:PaddingValues){Column(Modifier.fillMaxSize().padding(pad).padding(16.dp)){Text("Profil",fontSize=25.sp);Text("Ton compte Wallet Connect.",color=Muted,fontSize=13.sp);Spacer(Modifier.height(16.dp));Card(shape=androidx.compose.foundation.shape.RoundedCornerShape(22.dp)){Column(Modifier.padding(17.dp)){Text("Compte personnel",fontSize=18.sp);listOf("Informations personnelles","Vérification du compte","Moyens de paiement","Aide & support","Paramètres").forEach{Text(it,modifier=Modifier.fillMaxWidth().padding(vertical=16.dp),fontSize=13.sp)}}}}}
