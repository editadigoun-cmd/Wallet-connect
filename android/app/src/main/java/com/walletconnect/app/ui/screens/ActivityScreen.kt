package com.walletconnect.app.ui.screens
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.walletconnect.app.Muted
import com.walletconnect.app.ui.Empty
@Composable fun ActivityScreen(pad:PaddingValues){Column(Modifier.fillMaxSize().padding(pad).padding(16.dp)){Text("Activité",fontSize=25.sp);Text("Toutes tes opérations au même endroit.",color=Muted,fontSize=13.sp);Spacer(Modifier.height(16.dp));Row(horizontalArrangement=Arrangement.spacedBy(7.dp)){listOf("Tout","Envoyés","Reçus").forEach{Text(it,color=com.walletconnect.app.Teal,modifier=Modifier.padding(horizontal=12.dp,vertical=8.dp),fontSize=11.sp)}};Spacer(Modifier.height(12.dp));Empty("Aucune transaction pour le moment")}}
