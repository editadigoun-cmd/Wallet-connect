package com.walletconnect.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.walletconnect.app.Muted
import com.walletconnect.app.ui.*

@Composable fun HomeScreen(balance:Long,pad:PaddingValues,send:()->Unit,wallet:()->Unit){Column(Modifier.fillMaxSize().padding(pad).padding(16.dp)){Header();Text("Bonjour 👋",fontSize=25.sp,fontWeight=FontWeight.ExtraBold);Text("Voici l'état de ton portefeuille",color=Muted,fontSize=13.sp);Spacer(Modifier.height(16.dp));Balance(balance);Spacer(Modifier.height(16.dp));Row(horizontalArrangement=Arrangement.spacedBy(9.dp),modifier=Modifier.fillMaxWidth()){Quick("Envoyer",Modifier.weight(1f),send);Quick("Recharger",Modifier.weight(1f),wallet);Quick("Retirer",Modifier.weight(1f),wallet)};Spacer(Modifier.height(22.dp));Text("Activité récente",fontWeight=FontWeight.Bold,fontSize=16.sp);Spacer(Modifier.height(10.dp));Empty("Aucune transaction pour le moment");Spacer(Modifier.height(18.dp));Text("Mon portefeuille",fontWeight=FontWeight.Bold,fontSize=16.sp);Spacer(Modifier.height(10.dp));Stat("Devise","Solde principal","XAF");Stat("Frais d'envoi","Configuration actuelle","1%");Stat("Retrait","Frais plateforme","0 XAF")}}
