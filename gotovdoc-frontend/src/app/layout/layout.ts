import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navigation } from './navigation/navigation';
import { Footer } from './footer/footer';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, Navigation, Footer],
  templateUrl: './layout.html',
  styleUrl: './layout.css'
})
export class Layout {

}
