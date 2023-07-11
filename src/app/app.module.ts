import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { DiffMatchPatchModule } from 'ng-diff-match-patch';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    DiffMatchPatchModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
