package com.walletconnect.app

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.foundation.isSystemInDarkTheme

val Teal = Color(0xFF0F766E)
val TealSoft = Color(0xFFE7F6F3)
val Page = Color(0xFFF4F8F7)
val Ink = Color(0xFF12201E)
val Muted = Color(0xFF71807D)

@Composable
fun WalletConnectTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = lightColorScheme(primary=Teal, background=Page, surface=Color.White), content=content)
}
