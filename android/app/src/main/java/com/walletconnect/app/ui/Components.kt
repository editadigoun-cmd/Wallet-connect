package com.walletconnect.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.walletconnect.app.*

@Composable fun Header(){Row(Modifier.fillMaxWidth().padding(bottom=16.dp),Arrangement.SpaceBetween,Alignment.CenterVertically){Row(verticalAlignment=Alignment.CenterVertically){Box(Modifier.size(42.dp).background(Brush.linearGradient(listOf(Color(0xFF14B8A6),Teal)),RoundedCornerShape(14.dp)),Alignment.Center){Text("W",color=Color.White,fontWeight=FontWeight.ExtraBold)};Spacer(Modifier.width(10.dp));Column{Text("Wallet Connect",fontWeight=FontWeight.ExtraBold,fontSize=19.sp);Text("Paiements simples, partout",color=Muted,fontSize=11.sp)}};Surface(shape=RoundedCornerShape(50),color=Color.White){Text("A",Modifier.padding(12.dp),color=Teal)}}}
@Composable fun Balance(balance:Long){Card(colors=CardDefaults.cardColors(containerColor=Teal),shape=RoundedCornerShape(28.dp),modifier=Modifier.fillMaxWidth()){Column(Modifier.padding(22.dp)){Text("Solde disponible",color=Color.White.copy(.72f),fontSize=12.sp);Text(String.format("%,d XAF",balance),color=Color.White,fontSize=34.sp,fontWeight=FontWeight.ExtraBold);Spacer(Modifier.height(15.dp));Surface(color=Color.White.copy(.10f),shape=RoundedCornerShape(20.dp)){Text("XAF • Principal",color=Color.White,fontSize=11.sp,modifier=Modifier.padding(9.dp))}}}}
@Composable fun Stat(title:String,sub:String,value:String){Card(shape=RoundedCornerShape(18.dp),modifier=Modifier.fillMaxWidth().padding(bottom=8.dp)){Row(Modifier.fillMaxWidth().padding(14.dp),verticalAlignment=Alignment.CenterVertically){Column(Modifier.weight(1f)){Text(title,fontWeight=FontWeight.Bold,fontSize=13.sp);Text(sub,color=Muted,fontSize=11.sp)};Text(value,color=Teal,fontWeight=FontWeight.Bold,fontSize=13.sp)}}}
@Composable fun Empty(text:String){Card(shape=RoundedCornerShape(22.dp),modifier=Modifier.fillMaxWidth()){Box(Modifier.fillMaxWidth().padding(30.dp),Alignment.Center){Text(text,color=Muted,fontSize=13.sp)}}}
@Composable fun Quick(title:String,modifier:Modifier,action:()->Unit){OutlinedButton(onClick=action,modifier=modifier.height(92.dp),shape=RoundedCornerShape(18.dp)){Text(title,color=Ink,fontSize=11.sp)}}
