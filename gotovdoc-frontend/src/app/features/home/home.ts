import { Component } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-home',
  imports: [FormsModule, NgIf],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home {

  submitted = false;

  onSubmit(form: NgForm): void {
    if (form.valid) {
      this.submitted = true;
      // Here you could send data to backend / service
      console.log('Email submitted:', form.value.email);
      form.resetForm();
    }
  }

}
