/**
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Component, Inject } from '@angular/core';
//import { Observable } from 'rxjs/Observable';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { AngularFirestore } from '@angular/fire/firestore';
import { AngularFireStorage } from '@angular/fire/storage';
import { AngularFireAuth } from '@angular/fire/auth';
//import { MatSnackBar } from '@angular/material';
import { MatSnackBar } from '@angular/material/snack-bar';
import * as firebase from 'firebase';
//import auth
import { auth } from 'firebase/app';

const LOADING_IMAGE_URL = 'https://www.google.com/images/spin-32.gif';
const PROFILE_PLACEHOLDER_IMAGE_URL = '/assets/images/profile_placeholder.png';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  user: Observable<firebase.User>;
  currentUser: firebase.User;
  messages: Observable<any[]>;
  profilePicStyles: {};
  topics = '';
  value = '';

  constructor(public afs: AngularFirestore, public afAuth: AngularFireAuth, public storage: AngularFireStorage, public snackBar: MatSnackBar) {

    this.user = afAuth.authState;
    this.user.subscribe((user: firebase.User) => {
      console.log(user);
      this.currentUser = user;

      if (user) { // User is signed in!
        this.profilePicStyles = {
          'background-image':  `url(${this.currentUser.photoURL})`
        };

        // We load currently existing chat messages.
        this.messages = this.afs.collection<any>('messages', ref => ref.orderBy('timestamp', 'desc').limit(12)).valueChanges();
        //this.messages.subscribe((messages) => {
        this.messages.subscribe((res) => {
          // Calculate list of recently discussed topics
          /****
          const topicsMap = {};
          const topics = [];
          let hasEntities = false;
          messages.forEach((message) => {
            if (message.entities) {
              for (let entity of message.entities) {
                if (!topicsMap.hasOwnProperty(entity.name)) {
                  topicsMap[entity.name] = 0
                }
                topicsMap[entity.name] += entity.salience;
                hasEntities = true;
              }
            }
          });
          if (hasEntities) {
            for (let name in topicsMap) {
              topics.push({ name, score: topicsMap[name] });
            }
            topics.sort((a, b) => b.score - a.score);
            this.topics = topics.map((topic) => topic.name).join(', ');
          }
          ****/

          // Make sure new message scroll into view
          setTimeout(() => {
            const messageList = document.getElementById('messages');
            messageList.scrollTop = messageList.scrollHeight;
            document.getElementById('message').focus();
          // }, 500);
          }, 1000);
        });

        // We save the Firebase Messaging Device token and enable notifications.
        this.saveMessagingDeviceToken();
      } else { // User is signed out!
        this.profilePicStyles = {
          'background-image':  PROFILE_PLACEHOLDER_IMAGE_URL
        };
        this.topics = '';
      }
    });
  }

  login() {
    //this.afAuth.auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
    this.afAuth.signInWithPopup(new auth.GoogleAuthProvider());
  }

  logout() {
    //this.afAuth.auth.signOut();
    this.afAuth.signOut();
  }

  // TODO: Refactor into text message form component
  update(value: string) {
    this.value = value;
  }

  // Returns true if user is signed-in. Otherwise false and displays a message.
  checkSignedInWithMessage() {
    // Return true if the user is signed in Firebase
    if (this.currentUser) {
      return true;
    }

    this.snackBar
      .open('You must sign-in first', 'Sign in', {
        duration: 5000
      })
      .onAction()
      .subscribe(() => this.login());

    return false;
  };

  // TODO: Refactor into text message form component
  saveMessage(event: any, el: HTMLInputElement) {
    event.preventDefault();

    if (this.value && this.checkSignedInWithMessage()) {
      // Add a new message entry to the Firebase Database.
      const messages = this.afs.collection<any>('messages');
      // messages.push({
      messages.add({
        name: this.currentUser.displayName,
        text: this.value,
        profilePicUrl: this.currentUser.photoURL || PROFILE_PLACEHOLDER_IMAGE_URL,
        // add timestamp
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      }).then(() => {
        // Clear message text field and SEND button state.
        el.value = '';
      }, (err) => {
        this.snackBar.open('Error writing new message to Firebase Database.', null, {
          duration: 5000
        });
        console.error(err);
      });
    }
  }

  // TODO: Refactor into image message form component
  saveImageMessage(event: any) {
    event.preventDefault();
    const file = event.target.files[0];

    // Clear the selection in the file picker input.
    const imageForm = <HTMLFormElement>document.getElementById('image-form');
    imageForm.reset();

    // Check if the file is an image.
    if (!file.type.match('image.*')) {
      this.snackBar.open('You can only share images', null, {
        duration: 5000
      });
      return;
    }

    // Check if the user is signed-in
    if (this.checkSignedInWithMessage()) {

      // We add a message with a loading icon that will get updated with the shared image.
      const messages = this.afs.collection('messages');
      //messages.push({
      messages.add({
        name: this.currentUser.displayName,
        imageUrl: LOADING_IMAGE_URL,
        profilePicUrl: this.currentUser.photoURL || PROFILE_PLACEHOLDER_IMAGE_URL,
        // add timestamp
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      }).then((data) => {
        // Upload the image to Cloud Storage.
        //const filePath = `${this.currentUser.uid}/${data.key}/${file.name}`;
        const filePath = `${this.currentUser.uid}/${data.id}/${file.name}`;
        const fileRef = this.storage.ref(filePath);
//        var downloadURL: Observable<string>;

        //return firebase.storage().ref(filePath).put(file)
        const task = fileRef.put(file);

         // get notified when the download URL is available
          return task.snapshotChanges().pipe(
              finalize(() => {
                //downloadURL = fileRef.getDownloadURL();
                //console.log(downloadURL);
                // TODO: Instead of saving the download URL, save the GCS URI and
                //       dynamically load the download URL when displaying the image
                //       message.
                fileRef.getDownloadURL().subscribe(downloadURL => {
                  return data.update({
                    //imageUrl: metadata.downloadURLs[0]
                    imageUrl: downloadURL
                  });
                })
              })
           )
          .subscribe()
      }).then(console.log, (err) => {
        this.snackBar.open('There was an error uploading a file to Cloud Storage.', null, {
          duration: 5000
        });
        console.error(err);
      });
    }
  }

  // TODO: Refactor into image message form component
  onImageClick(event: any) {
    event.preventDefault();
    document.getElementById('mediaCapture').click();
  }

  // Saves the messaging device token to the datastore.
  saveMessagingDeviceToken() {
    return firebase.messaging().getToken()
      .then((currentToken) => {
        if (currentToken) {
          console.log('Got FCM device token:', currentToken);
          // Save the Device Token to the datastore.
          /********
          firebase.database()
            .ref('/fcmTokens')
            .child(currentToken)
            .set(this.currentUser.uid);
          ******/
          this.afs.collection<any>('fcmTokens').doc(currentToken).set(
          {uid: this.currentUser.uid}, 
          {merge: true}
          );
        } else {
          // Need to request permissions to show notifications.
          return this.requestNotificationsPermissions();
        }
      }).catch((err) => {
        this.snackBar.open('Unable to get messaging token.', null, {
          duration: 5000
        });
        console.error(err);
      });
  };

  // Requests permissions to show notifications.
  requestNotificationsPermissions() {
    console.log('Requesting notifications permission...');
    return firebase.messaging().requestPermission()
      // Notification permission granted.
      .then(() => this.saveMessagingDeviceToken())
      .catch((err) => {
        this.snackBar.open('Unable to get permission to notify.', null, {
          duration: 5000
        });
        console.error(err);
      });
  };
}