from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Query, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import List, Optional, Annotated
from datetime import datetime, timedelta
import jwt
import os
import logging
from pydantic import BaseModel, EmailStr, Field, validator
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
import uuid
import json
from fastapi.responses import JSONResponse
import shutil
from pathlib import Path
from fastapi.staticfiles import StaticFiles
import requests

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


DATABASE_URL = "postgresql://postgres:rv@localhost:5432/CommunityPulse"
CLERK_SECRET_KEY = "sk_test_OTSjCgK3YwYAPsR9y8NDjbmJOAlDy6pogqa4MHxL3u"  # Replace with your Clerk secret key
CLERK_PEM_PUBLIC_KEY = """
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA42smZzN37TQeHCCWIHom
HEqntoKVVHYJYSFg5+qIYRVRb4GVrNDMmPfcrUKT/S7Hw3wOsr0AFBPVjAXPQmF3
e05STUh8zh0pTHFJFb72ythK9TUl9zpMa61gU6I6zxnpsXiN37Pn5MoC2raWyyUr
MvmnL0YM2sgE2v02gk/VIR3uWQuD3kS/heVNfZTuREV6pWyw3M//ywNwl/2sG7pX
iGZvHBlAGPXVP61cjDhSj+Hlvyd8kOfFKJh3Dwa0WgEF0rGke8ksdOmYZOFfm/ba
r/s7K4mjQRxZVr2cHBcYVKxiK+/gG8SvJ8MKhyE2PDP1ae6vZfB6YI9THUSMUfHF
8wIDAQAB
-----END PUBLIC KEY-----
"""  # Replace with your Clerk JWT public key

# Define admin email
ADMIN_EMAIL = "rohithvishwanath1789@gmail.com"

# Database setup
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Create app
app = FastAPI(title="Community Pulse API")

# Configure CORS
origins = [
    "http://localhost",
    "http://localhost:3000",  # NextJS default port
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path("./uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Serve static files
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Clerk authentication
security = HTTPBearer()

# Database Models
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    clerk_id = Column(String, unique=True, index=True)
    username = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    phone = Column(String)
    is_admin = Column(Boolean, default=False)
    is_verified_organizer = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_banned = Column(Boolean, default=False)
    
    # Relationships
    events = relationship("Event", back_populates="organizer")
    event_registrations = relationship("EventRegistration", back_populates="user")

class Event(Base):
    __tablename__ = "events"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(Text)
    location = Column(Text)  # This will store the formatted address
    category = Column(String, index=True)
    start_date = Column(DateTime, index=True)
    end_date = Column(DateTime, index=True)
    registration_start = Column(DateTime)
    registration_end = Column(DateTime)
    image_path = Column(String, nullable=True)
    organizer_id = Column(Integer, ForeignKey("users.id"))
    is_approved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    attendees_count = Column(Integer, default=0)
    
    # Relationships
    organizer = relationship("User", back_populates="events")
    registrations = relationship("EventRegistration", back_populates="event", cascade="all, delete-orphan")

class EventRegistration(Base):
    __tablename__ = "event_registrations"
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"))
    user_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String, default="interested")  # "interested", "registered", "cancelled"
    attendees = Column(Text)  # JSON string containing array of attendee names
    number_of_attendees = Column(Integer, default=1)
    registered_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    event = relationship("Event", back_populates="registrations")
    user = relationship("User", back_populates="event_registrations")

class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"))
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String)
    message = Column(Text)
    is_read = Column(Boolean, default=False)
    notification_type = Column(String)  # "reminder", "update", "cancellation"
    created_at = Column(DateTime, default=datetime.utcnow)
    
# Create all tables
Base.metadata.create_all(bind=engine)

# Setup admin user on startup
@app.on_event("startup")
async def setup_admin():
    db = SessionLocal()
    try:
        # Find user by email
        admin_user = db.query(User).filter(User.email == ADMIN_EMAIL).first()
        
        if admin_user:
            # Set as admin if not already
            if not admin_user.is_admin:
                admin_user.is_admin = True
                db.commit()
                logger.info(f"User {admin_user.email} set as admin")
        else:
            logger.info(f"Admin user {ADMIN_EMAIL} not found in database yet")
    except Exception as e:
        logger.error(f"Error setting up admin user: {e}")
    finally:
        db.close()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Pydantic Models (Request & Response Models)
class UserResponse(BaseModel):
    id: int
    clerk_id: str
    username: str
    email: str
    phone: Optional[str] = None
    is_admin: bool
    is_verified_organizer: bool
    
    class Config:
        from_attributes = True

class EventCreate(BaseModel):
    title: str
    description: str
    location: str
    category: str
    start_date: datetime
    end_date: datetime
    registration_start: datetime
    registration_end: datetime

class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    category: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    registration_start: Optional[datetime] = None
    registration_end: Optional[datetime] = None

class EventResponse(BaseModel):
    id: int
    title: str
    description: str
    location: str
    category: str
    start_date: datetime
    end_date: datetime
    registration_start: datetime
    registration_end: datetime
    image_path: Optional[str] = None
    organizer_id: int
    is_approved: bool
    created_at: datetime
    updated_at: datetime
    attendees_count: int
    is_registered: Optional[bool] = None
    
    class Config:
        from_attributes = True

class EventRegistrationCreate(BaseModel):
    number_of_attendees: int = Field(ge=1, description="Number of attendees must be at least 1")
    attendees: List[str] = Field(
        ...,
        min_items=1,
        description="List of attendee names"
    )

    @validator("attendees")
    def validate_attendees(cls, v):
        if not all(name.strip() for name in v):
            raise ValueError("Attendee names cannot be empty")
        if len(v) > 10:
            raise ValueError("Maximum 10 attendees allowed per registration")
        return v

    @validator("number_of_attendees")
    def validate_number_of_attendees(cls, v, values):
        if "attendees" in values and v != len(values["attendees"]):
            raise ValueError("Number of attendees must match the length of attendees list")
        return v

class EventRegistrationResponse(BaseModel):
    id: int
    event_id: int
    user_id: Optional[int] = None
    status: str
    attendees: List[str]
    number_of_attendees: int
    registered_at: datetime
    
    class Config:
        from_attributes = True

class AdminUserUpdate(BaseModel):
    is_admin: Optional[bool] = None
    is_verified_organizer: Optional[bool] = None
    is_banned: Optional[bool] = None

# Clerk authentication helpers
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    
    try:
        # Verify the token with Clerk, with leeway for iat validation
        payload = jwt.decode(
            token, 
            key=CLERK_PEM_PUBLIC_KEY, 
            algorithms=['RS256'],
            options={"verify_iat": False}
        )
        clerk_user_id = payload.get("sub")
        if not clerk_user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Get or create user in our database
        user = db.query(User).filter(User.clerk_id == clerk_user_id).first()
        
        if not user:
            # Fetch user details from Clerk
            headers = {
                "Authorization": f"Bearer {CLERK_SECRET_KEY}",
                "Content-Type": "application/json"
            }
            clerk_user_response = requests.get(
                f"https://api.clerk.dev/v1/users/{clerk_user_id}",
                headers=headers
            )
            
            if clerk_user_response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Failed to verify user with Clerk",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
            clerk_user_data = clerk_user_response.json()
            
            # Create a new user in our database
            primary_email = next((email for email in clerk_user_data.get("email_addresses", []) 
                                    if email.get("id") == clerk_user_data.get("primary_email_address_id")), {})
            
            email_address = primary_email.get("email_address", "")
            
            # Check if this is the admin email
            is_admin = email_address == ADMIN_EMAIL
            
            user = User(
                clerk_id=clerk_user_id,
                username=clerk_user_data.get("username") or f"user_{clerk_user_id}",
                email=email_address,
                phone=clerk_user_data.get("phone_number", ""),
                is_admin=is_admin
            )
            
            db.add(user)
            db.commit()
            db.refresh(user)
            
            logger.info(f"Created new user: {user.email}, admin: {user.is_admin}")
        else:
            # Check if this is the admin email and update if needed
            if user.email == ADMIN_EMAIL and not user.is_admin:
                user.is_admin = True
                db.commit()
                db.refresh(user)
                logger.info(f"Updated user {user.email} to admin status")
        
        if user.is_banned:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is banned from the platform"
            )
        
        return user
        
    except jwt.PyJWTError as e:
        logger.error(f"JWT error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication error"
        )

async def get_admin_user(current_user: User = Depends(get_current_user)):
    logger.info(f"Admin check for user: {current_user.email}, is_admin: {current_user.is_admin}")
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user

# User endpoints
@app.get("/users/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

# Event endpoints
@app.post("/events", response_model=EventResponse)
async def create_event(
    title: str = Form(...),
    description: str = Form(...),
    location: str = Form(...),  # This will receive the formatted address from frontend
    category: str = Form(...),
    start_date: str = Form(...),
    end_date: str = Form(...),
    registration_start: str = Form(...),
    registration_end: str = Form(...),
    image: UploadFile = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Parse datetime strings
    start_date_dt = datetime.fromisoformat(start_date)
    end_date_dt = datetime.fromisoformat(end_date)
    registration_start_dt = datetime.fromisoformat(registration_start)
    registration_end_dt = datetime.fromisoformat(registration_end)
    
    # Create event
    db_event = Event(
        title=title,
        description=description,
        location=location,
        category=category,
        start_date=start_date_dt,
        end_date=end_date_dt,
        registration_start=registration_start_dt,
        registration_end=registration_end_dt,
        organizer_id=current_user.id,
        is_approved=current_user.is_verified_organizer,  # Auto-approve for verified organizers
        attendees_count=0
    )
    
    # Handle image upload if provided
    if image:
        # Create a unique filename
        file_extension = image.filename.split(".")[-1]
        filename = f"{uuid.uuid4()}.{file_extension}"
        file_location = f"uploads/{filename}"
        
        # Save the file
        with open(file_location, "wb") as file_object:
            shutil.copyfileobj(image.file, file_object)
        
        db_event.image_path = file_location
    
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    
    logger.info(f"Created event: {db_event.id}, approved: {db_event.is_approved}")
    
    return db_event

@app.get("/events", response_model=List[EventResponse])
def get_events(
    category: Optional[str] = None,
    upcoming: bool = False,
    approved_only: bool = True,
    db: Session = Depends(get_db)
):
    query = db.query(Event)
    
    # Filter by approval status
    if approved_only:
        query = query.filter(Event.is_approved == True)
    
    # Filter by category if provided
    if category:
        query = query.filter(Event.category == category)
    
    # Filter for upcoming events
    if upcoming:
        query = query.filter(Event.start_date >= datetime.utcnow())
    
    # Sort by start date
    events = query.order_by(Event.start_date).all()
    
    logger.info(f"Fetched {len(events)} events (approved_only={approved_only})")
    
    return events

@app.get("/events/{event_id}", response_model=EventResponse)
def get_event(event_id: int, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    return event

@app.put("/events/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: int,
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    start_date: Optional[str] = Form(None),
    end_date: Optional[str] = Form(None),
    registration_start: Optional[str] = Form(None),
    registration_end: Optional[str] = Form(None),
    image: UploadFile = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch event
    event = db.query(Event).filter(Event.id == event_id).first()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # Check if user is organizer or admin
    if event.organizer_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this event"
        )
    
    # Update fields if provided
    if title:
        event.title = title
    if description:
        event.description = description
    if location:
        event.location = location
    if category:
        event.category = category
    if start_date:
        event.start_date = datetime.fromisoformat(start_date)
    if end_date:
        event.end_date = datetime.fromisoformat(end_date)
    if registration_start:
        event.registration_start = datetime.fromisoformat(registration_start)
    if registration_end:
        event.registration_end = datetime.fromisoformat(registration_end)
    
    # Non-verified organizers need re-approval after updates
    if not current_user.is_verified_organizer and not current_user.is_admin:
        event.is_approved = False
    
    # Handle image upload if provided
    if image:
        # Delete old image if exists
        if event.image_path and os.path.exists(event.image_path):
            os.remove(event.image_path)
        
        # Create a unique filename
        file_extension = image.filename.split(".")[-1]
        filename = f"{uuid.uuid4()}.{file_extension}"
        file_location = f"uploads/{filename}"
        
        # Save the file
        with open(file_location, "wb") as file_object:
            shutil.copyfileobj(image.file, file_object)
        
        event.image_path = file_location
    
    # Update timestamp
    event.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(event)
    
    # Create notifications for registered users about event update
    for registration in event.registrations:
        notification = Notification(
            event_id=event.id,
            user_id=registration.user_id,
            title="Event Updated",
            message=f"The event '{event.title}' you registered for has been updated.",
            notification_type="update"
        )
        db.add(notification)
    
    db.commit()
    
    return event

@app.delete("/events/{event_id}")
async def delete_event(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch event
    event = db.query(Event).filter(Event.id == event_id).first()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # Check if user is organizer or admin
    if event.organizer_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this event"
        )
    
    # Create cancellation notifications for registered users
    for registration in event.registrations:
        notification = Notification(
            event_id=event.id,
            user_id=registration.user_id,
            title="Event Cancelled",
            message=f"The event '{event.title}' has been cancelled.",
            notification_type="cancellation"
        )
        db.add(notification)
    
    # Delete the event image if it exists
    if event.image_path and os.path.exists(event.image_path):
        try:
            os.remove(event.image_path)
        except:
            pass
    
    # Delete the event
    db.delete(event)
    db.commit()
    
    return {"message": "Event deleted successfully"}

# Event Registration endpoints
@app.post("/events/{event_id}/register", response_model=EventRegistrationResponse)
async def register_for_event(
    event_id: int,
    registration: EventRegistrationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch event
    event = db.query(Event).filter(Event.id == event_id).first()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    if not event.is_approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot register for an unapproved event"
        )
    
    # Check if registration period is open
    now = datetime.utcnow()
    if now < event.registration_start or now > event.registration_end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration is not open for this event"
        )
    
    # Check if already registered
    existing_registration = db.query(EventRegistration).filter(
        EventRegistration.event_id == event_id,
        EventRegistration.user_id == current_user.id
    ).first()
    
    if existing_registration:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already registered for this event"
        )
    
    # Create registration
    db_registration = EventRegistration(
        event_id=event_id,
        user_id=current_user.id,
        status="registered",
        attendees=json.dumps(registration.attendees),
        number_of_attendees=registration.number_of_attendees
    )
    
    db.add(db_registration)
    
    # Update attendees count
    event.attendees_count = event.attendees_count + registration.number_of_attendees
    
    db.commit()
    db.refresh(db_registration)
    
    # Create reminder notification
    reminder_date = event.start_date - timedelta(days=1)
    if reminder_date > now:
        notification = Notification(
            event_id=event.id,
            user_id=current_user.id,
            title="Event Reminder",
            message=f"Reminder: The event '{event.title}' is tomorrow!",
            notification_type="reminder"
        )
        db.add(notification)
        db.commit()
    
    return db_registration

@app.post("/events/{event_id}/interest")
async def mark_interest(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch event
    event = db.query(Event).filter(Event.id == event_id).first()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    if not event.is_approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot show interest in an unapproved event"
        )
    
    # Check if already registered
    existing_registration = db.query(EventRegistration).filter(
        EventRegistration.event_id == event_id,
        EventRegistration.user_id == current_user.id
    ).first()
    
    if existing_registration:
        if existing_registration.status == "cancelled":
            # Reactivate interest
            existing_registration.status = "interested"
            event.attendees_count = event.attendees_count + 1  # Add 1 for interested status
            db.commit()
            return {"message": "Interest marked successfully", "registration_id": existing_registration.id}
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are already interested or registered for this event"
            )
    
    # Create a registration with "interested" status
    db_registration = EventRegistration(
        event_id=event_id,
        user_id=current_user.id,
        status="interested",
        attendees=json.dumps([current_user.username]),
        number_of_attendees=1  # Start with 1 for interested status
    )
    
    db.add(db_registration)
    event.attendees_count = event.attendees_count + 1  # Add 1 for interested status
    db.commit()
    db.refresh(db_registration)
    
    return {"message": "Interest marked successfully", "registration_id": db_registration.id}

@app.post("/events/{event_id}/confirm-registration")
async def confirm_registration(
    event_id: int,
    registration_data: EventRegistrationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch event
    event = db.query(Event).filter(Event.id == event_id).first()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # Check if registration period is open
    now = datetime.utcnow()
    # Add a buffer time of 24 hours to account for timezone differences
    buffer_time = timedelta(hours=24)
    registration_start_with_buffer = event.registration_start - buffer_time
    registration_end_with_buffer = event.registration_end + buffer_time
    
    logger.info(f"Registration period check for event {event_id}:")
    logger.info(f"Current time (UTC): {now}")
    logger.info(f"Registration start (with buffer): {registration_start_with_buffer}")
    logger.info(f"Registration end (with buffer): {registration_end_with_buffer}")
    
    if now < registration_start_with_buffer or now > registration_end_with_buffer:
        logger.warning(f"Registration not open. Current time: {now}, Registration period (with buffer): {registration_start_with_buffer} to {registration_end_with_buffer}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration is not open for this event"
        )
    
    # Get existing registration
    registration = db.query(EventRegistration).filter(
        EventRegistration.event_id == event_id,
        EventRegistration.user_id == current_user.id
    ).first()
    
    if not registration or registration.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must first mark interest in this event"
        )
    
    if registration.status == "registered":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already registered for this event"
        )
    
    # Update registration
    old_attendees_count = registration.number_of_attendees
    registration.status = "registered"
    registration.attendees = json.dumps(registration_data.attendees)
    registration.number_of_attendees = registration_data.number_of_attendees
    
    # Update event attendees count
    # First subtract the old count (from "interested" status)
    event.attendees_count = event.attendees_count - old_attendees_count
    # Then add the new count
    event.attendees_count = event.attendees_count + registration_data.number_of_attendees
    
    db.commit()
    db.refresh(registration)
    
    # Create reminder notification
    reminder_date = event.start_date - timedelta(days=1)
    if reminder_date > now:
        notification = Notification(
            event_id=event.id,
            user_id=current_user.id,
            title="Event Reminder",
            message=f"Reminder: The event '{event.title}' is tomorrow!",
            notification_type="reminder"
        )
        db.add(notification)
        db.commit()
    
    return registration

@app.post("/events/{event_id}/cancel-registration")
async def cancel_registration(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch registration
    registration = db.query(EventRegistration).filter(
        EventRegistration.event_id == event_id,
        EventRegistration.user_id == current_user.id
    ).first()
    
    if not registration or registration.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registration not found"
        )
    
    # Update event attendees count
    event = registration.event
    event.attendees_count = max(0, event.attendees_count - registration.number_of_attendees)
    
    # Update registration status
    registration.status = "cancelled"
    
    db.commit()
    
    return {"message": "Registration cancelled successfully"}

@app.get("/user/events/registered", response_model=List[EventResponse])
async def get_user_registered_events(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    registrations = db.query(EventRegistration).filter(
        EventRegistration.user_id == current_user.id,
        EventRegistration.status == "registered"
    ).all()
    events = [registration.event for registration in registrations]
    return events

@app.get("/user/events/interested", response_model=List[EventResponse])
async def get_user_interested_events(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    registrations = db.query(EventRegistration).filter(
        EventRegistration.user_id == current_user.id,
        EventRegistration.status == "interested"
    ).all()
    events = [registration.event for registration in registrations]
    return events

@app.get("/events/{event_id}/registration-status")
async def get_registration_status(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    registration = db.query(EventRegistration).filter(
        EventRegistration.event_id == event_id,
        EventRegistration.user_id == current_user.id
    ).first()
    
    if not registration or registration.status == "cancelled":
        return {
            "status": "none",
            "registration": None
        }
    
    return {
        "status": registration.status,
        "registration": {
            "id": registration.id,
            "attendees": json.loads(registration.attendees),
            "number_of_attendees": registration.number_of_attendees,
            "registered_at": registration.registered_at
        }
    }

# Admin endpoints
@app.get("/admin/events/pending", response_model=List[EventResponse])
async def get_pending_events(
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    events = db.query(Event).filter(Event.is_approved == False).all()
    logger.info(f"Found {len(events)} pending events for admin {admin_user.email}")
    return events

@app.put("/admin/events/{event_id}/approve")
async def approve_event(
    event_id: int,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    event.is_approved = True
    db.commit()
    
    logger.info(f"Admin {admin_user.email} approved event {event_id}")
    
    return {"message": "Event approved successfully"}

@app.put("/admin/events/{event_id}/reject")
async def reject_event(
    event_id: int,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # Option 1: Delete the event
    db.delete(event)
    db.commit()
    
    logger.info(f"Admin {admin_user.email} rejected event {event_id}")
    
    return {"message": "Event rejected and deleted successfully"}

@app.get("/admin/users", response_model=List[UserResponse])
async def get_all_users(
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    users = db.query(User).all()
    return users

@app.put("/admin/users/{user_id}")
async def update_user_status(
    user_id: int,
    user_update: AdminUserUpdate,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if user_update.is_admin is not None:
        user.is_admin = user_update.is_admin
    
    if user_update.is_verified_organizer is not None:
        user.is_verified_organizer = user_update.is_verified_organizer
    
    if user_update.is_banned is not None:
        user.is_banned = user_update.is_banned
    
    db.commit()
    
    return {"message": "User updated successfully"}

@app.put("/admin/users/{user_id}/verify-organizer")
async def verify_organizer(
    user_id: int,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user.is_verified_organizer = True
    db.commit()
    
    logger.info(f"Admin {admin_user.email} verified user {user.email} as organizer")
    
    return {"message": "User verified as organizer successfully"}

@app.get("/admin/events/user/{user_id}", response_model=List[EventResponse])
async def get_user_events(
    user_id: int,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    events = db.query(Event).filter(Event.organizer_id == user_id).all()
    return events

# My events endpoint (for users to see their own events)
@app.get("/my-events", response_model=List[EventResponse])
async def get_my_events(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    events = db.query(Event).filter(Event.organizer_id == current_user.id).all()
    return events

# My registrations endpoint
@app.get("/my-registrations", response_model=List[EventRegistrationResponse])
async def get_my_registrations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    registrations = db.query(EventRegistration).filter(
        EventRegistration.user_id == current_user.id
    ).all()
    
    return registrations

# Notifications endpoints
@app.get("/notifications")
async def get_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notifications = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).order_by(Notification.created_at.desc()).all()
    
    return notifications

@app.put("/notifications/{notification_id}/read")
async def mark_notification_as_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    notification.is_read = True
    db.commit()
    
    return {"message": "Notification marked as read"}

# Search events endpoint
@app.get("/search", response_model=List[EventResponse])
def search_events(
    query: str = Query(..., min_length=1),
    db: Session = Depends(get_db)
):
    events = db.query(Event).filter(
        Event.is_approved == True,
        (
            Event.title.ilike(f"%{query}%") |
            Event.description.ilike(f"%{query}%") |
            Event.location.ilike(f"%{query}%") |
            Event.category.ilike(f"%{query}%")
        )
    ).order_by(Event.start_date).all()
    
    return events

# Clerk webhook endpoint for syncing user data
@app.post("/clerk-webhook")
async def clerk_webhook(request: Request, db: Session = Depends(get_db)):
    # Verify webhook signature (in production, you should validate the webhook signature)
    payload = await request.json()
    event_type = payload.get("type")
    
    if event_type == "user.created" or event_type == "user.updated":
        data = payload.get("data", {})
        clerk_user_id = data.get("id")
        
        if not clerk_user_id:
            return {"status": "error", "message": "Invalid webhook payload"}
        
        # Get or create user
        user = db.query(User).filter(User.clerk_id == clerk_user_id).first()
        
        # Extract primary email
        primary_email_id = data.get("primary_email_address_id")
        email_addresses = data.get("email_addresses", [])
        primary_email = next((email.get("email_address") for email in email_addresses 
                           if email.get("id") == primary_email_id), None)
        
        if not user and primary_email:
            # Check if this is the admin email
            is_admin = primary_email == ADMIN_EMAIL
            
            # Create new user
            user = User(
                clerk_id=clerk_user_id,
                username=data.get("username") or f"user_{clerk_user_id}",
                email=primary_email,
                phone=data.get("phone_numbers", [{}])[0].get("phone_number", "") if data.get("phone_numbers") else "",
                is_admin=is_admin
            )
            db.add(user)
            logger.info(f"Created new user from webhook: {primary_email}, admin: {is_admin}")
        elif user and primary_email:
            # Update existing user
            user.username = data.get("username") or user.username
            user.email = primary_email
            
            # Check if this is the admin email
            if primary_email == ADMIN_EMAIL and not user.is_admin:
                user.is_admin = True
                logger.info(f"Updated user to admin status: {primary_email}")
                
            if data.get("phone_numbers"):
                user.phone = data.get("phone_numbers", [{}])[0].get("phone_number", "") or user.phone
        
        db.commit()
        
        return {"status": "success", "message": "User data synced"}
    
    elif event_type == "user.deleted":
        data = payload.get("data", {})
        clerk_user_id = data.get("id")
        
        if not clerk_user_id:
            return {"status": "error", "message": "Invalid webhook payload"}
        
        # Find and mark user as deleted or handle as needed
        user = db.query(User).filter(User.clerk_id == clerk_user_id).first()
        if user:
            user.is_banned = True  # Or implement your own deletion policy
            db.commit()
        
        return {"status": "success", "message": "User deletion handled"}
    
    return {"status": "success", "message": "Webhook received"}

@app.get("/user/events/created", response_model=List[EventResponse])
async def get_user_created_events(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    events = db.query(Event).filter(Event.organizer_id == current_user.id).all()
    return events

@app.get("/user/events/signedup", response_model=List[EventResponse])
async def get_user_signedup_events(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    registrations = db.query(EventRegistration).filter(EventRegistration.user_id == current_user.id).all()
    events = [registration.event for registration in registrations]
    return events

@app.get("/events/{event_id}/details", response_model=EventResponse)
async def get_event_details(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Check if user is registered
    registration = db.query(EventRegistration).filter(
        EventRegistration.event_id == event_id,
        EventRegistration.user_id == current_user.id
    ).first()
    
    # Add registration status to response
    event_dict = EventResponse.model_validate(event).model_dump()
    event_dict["is_registered"] = registration is not None
    return event_dict

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)