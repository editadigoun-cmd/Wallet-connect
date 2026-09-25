package com.walletconnect.app.ui.screens
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.walletconnect.app.Muted
import com.walletconnect.app.Teal
import com.walletconnect.app.ui.*
@Composable fun WalletScreen(balance:Long,pad:PaddingValues,topup:(Long)->Unit){var amount by remember{mutableStateOf("")};Column(Modifier.fillMaxSize().padding(pad).padding(16.dp)){Text("Portefeuille",fontSize=25.sp,fontWeight=FontWeight.ExtraBold);Text("Gère ton argent et tes moyens de paiement.",color=Muted,fontSize=13.sp);Spacer(Modifier.height(16.dp));Balance(balance);Spacer(Modifier.height(14.dp));Card(shape=androidx.compose.foundation.shape.RoundedCornerShape(22.dp)){Column(Modifier.padding(17.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){Text("Recharger",fontWeight=FontWeight.Bold,fontSize=16.sp);OutlinedTextField(amount,{amount=it.filter(Char::isDigit)},label={Text("Montant en XAF")},modifier=Modifier.fillMaxWidth(),singleLine=true);Text("MTN Mobile Money",color=Teal,fontWeight=FontWeight.Bold);Button(onClick={amount.toLongOrNull()?.takeIf{it>0}?.let(topup)},modifier=Modifier.fillMaxWidth(),shape=androidx.compose.foundation.shape.RoundedCornerShape(15.dp)){Text("Continuer avec MTN")}}};Spacer(Modifier.height(12.dp));Empty("Retrait MTN disponible pour le premier test.")}}
