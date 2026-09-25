package com.walletconnect.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.walletconnect.app.Muted
import com.walletconnect.app.ui.Stat

@Composable fun SendScreen(balance:Long,pad:PaddingValues,done:(Long)->Unit){var phone by remember{mutableStateOf("")};var amount by remember{mutableStateOf("")};val value=amount.toLongOrNull()?:0L;val fee=(value*.01).toLong();Column(Modifier.fillMaxSize().padding(pad).padding(16.dp)){Text("Envoyer de l'argent",fontSize=25.sp,fontWeight=FontWeight.ExtraBold);Text("Transfère rapidement à un autre utilisateur.",color=Muted,fontSize=13.sp);Spacer(Modifier.height(18.dp));Card(shape=androidx.compose.foundation.shape.RoundedCornerShape(22.dp)){Column(Modifier.padding(17.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){OutlinedTextField(phone,{phone=it},label={Text("Téléphone ou identifiant")},modifier=Modifier.fillMaxWidth(),singleLine=true);OutlinedTextField(amount,{amount=it.filter(Char::isDigit)},label={Text("Montant en XAF")},modifier=Modifier.fillMaxWidth(),singleLine=true);Stat("Frais d'envoi","1% du montant",fee.toString()+" XAF");Stat("Total débité","Montant + frais",(value+fee).toString()+" XAF");Button(onClick={if(phone.isNotBlank()&&value>0&&value+fee<=balance)done(value)},modifier=Modifier.fillMaxWidth(),shape=androidx.compose.foundation.shape.RoundedCornerShape(15.dp)){Text("Continuer",fontWeight=FontWeight.Bold)}}}}}
